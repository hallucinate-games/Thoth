import dataclasses
from dataclasses import dataclass
from enum import StrEnum
from itertools import chain
import os
import time
from typing import Generator, List, Literal, Optional, Set

import chromadb
from chromadb.api.types import D, EmbeddingFunction, Embeddings
from chromadb.utils import embedding_functions
import math
from nltk import download
from nltk.tokenize import sent_tokenize

from util import AbstractDataClass, get_file_download_path

_punkt_downloaded = False
_chroma_client = None
_collection = None

chroma_client = chromadb.Client()


class AinekoEmbeddingFunction(EmbeddingFunction):
    def __call__(self, input: D) -> Embeddings:
        # Currently a pass-through function. Leaving it here in case we need to
        # inject functionality at the embedding layer.
        embeddings = embedding_functions.DefaultEmbeddingFunction()(input)
        return embeddings


def create_collection(name: str=None, persistent: bool=False):
    global _chroma_client
    global _collection
    name = name or 'aineko-demo'
    if persistent:
        _chroma_client = chromadb.PersistentClient(path="../demo-db")
    else:
        _chroma_client = chromadb.Client()
    _collection = chroma_client.get_or_create_collection(name=name, embedding_function=AinekoEmbeddingFunction())

    if persistent:
        _chroma_client.delete_collection(name)
        _collection = chroma_client.get_or_create_collection(name="aineko-demo", embedding_function=AinekoEmbeddingFunction())
    return _collection


def get_collection():
    global _collection
    if not _collection:
        return create_collection()
    return _collection
    

def add_file_to_collection(file_path: str):
    """ Add chunks of a file to a chromadb collection """
    document_chunks = _generate_overlapping_chunks(file_path)
    chunks_added = 0
    for chunk in document_chunks:
        _collection.add(
            ids=[f"chunk{chunk.chunk_idx}:{file_path}"],
            documents=[chunk.text],
            metadatas=[chunk.generate_metadata_object()]
        )
        chunks_added += 1
    maybe_plural_chunks = 'chunk' if chunks_added == 1 else 'chunks'
    print(f"Added {chunks_added} {maybe_plural_chunks} to collection from file {file_path}")


def add_dir_to_collection(dir: str):
    files_added = []
    for root, _, files in os.walk(dir):
        for file in files:
            file_path = os.path.join(root, file)
            add_file_to_collection(file_path)
            files_added.append(file_path)
    return files_added


def _sentence_chunk_file(file_path: str) -> Generator[str, None, None]:
    with open(file_path, 'r', encoding='utf-8') as f:
        raw_text = f.read()

    return _sentence_chunk_text(raw_text=raw_text)
        

def _sentence_chunk_text(raw_text: str) -> Generator[str, None, None]:
    """ Breaks a file into approximately sentence sized chunks. """
    global _punkt_downloaded
    if not _punkt_downloaded:
        # Used by `_sentence_chunk_file` for sentence tokenization
        try:
            download('punkt')
            _punkt_downloaded = True
        except Exception as exc:
            print(
                "While you do not need an internet connection to run aineko, "
                "you do need to be connected to the internet the first time you run "
                "it to download the sentence tokenization system.")
            raise exc

    # Tokenize the text into sentences and words
    sentences = sent_tokenize(raw_text)
    
    current_chunk = ''
    for sentence in sentences:
        if len(sentence) < 5:
            current_chunk += ' ' + sentence
        else:
            yield current_chunk
            current_chunk = sentence
    yield current_chunk


def _get_file_times(file_path):
    # Get the creation time
    creation_time = os.path.getctime(file_path)
    # Get the last modification time
    modification_time = os.path.getmtime(file_path)

    # Convert the timestamps to readable format
    creation_time = time.ctime(creation_time)
    modification_time = time.ctime(modification_time)

    return creation_time, modification_time


@dataclass
class DocumentChunk:
    text: str
    file_path: str
    chunk_idx: int
    begin_overlap_length: int
    end_overlap_length: int
    file_created_at: str
    file_last_updated_at: str

    def text_with_metadata(self):
        return f"[File] {self.file_path}\n[Created at] {self.file_created_at}\n[Last updated at] {self.file_last_updated_at}\n[Chunk contents]\n{self.text}"

    def generate_metadata_object(self):
        return {
            "file_path": self.file_path,
            "chunk_index": self.chunk_idx,
            "file_created_at": self.file_created_at,
            "file_last_updated_at": self.file_last_updated_at,
            "begin_overlap_length": self.begin_overlap_length,
            "end_overlap_length": self.end_overlap_length
        }


def _generate_overlapping_chunks(
        file_path: str,
        chunk_size: int = 4,
        overlap: int = 1,
        ) -> Generator[DocumentChunk, None, None]:
    """ Generates overlapping chunks from file packaged with metadata. """
    sentence_chunks = _sentence_chunk_file(file_path)
    file_created_at, file_last_updated_at = _get_file_times(file_path)
    current_chunk_idx = 0
    chunk_buffer = []
    for sentence in sentence_chunks:
        chunk_buffer.append(sentence)
        if len(chunk_buffer) >= chunk_size:
            yield DocumentChunk(
                text=' '.join(chunk_buffer),
                file_path=file_path,
                chunk_idx=current_chunk_idx,
                begin_overlap_length=sum([len(_) for _ in chunk_buffer[:overlap]]) + (len(chunk_buffer[:overlap]) - 1),
                end_overlap_length=sum([len(_) for _ in chunk_buffer[-overlap:]]) + (len(chunk_buffer[-overlap:])- 1),
                file_created_at=file_created_at,
                file_last_updated_at=file_last_updated_at,
            )
            current_chunk_idx += 1
            chunk_buffer = chunk_buffer[-overlap:]
    if (len(chunk_buffer) and chunk_buffer[0] != '') and (len(chunk_buffer) != overlap or current_chunk_idx == 0):
        yield DocumentChunk(
            text=' '.join(chunk_buffer),
            file_path=file_path,
            chunk_idx=current_chunk_idx,
            begin_overlap_length=sum([len(_) for _ in chunk_buffer[:overlap]]) + (len(chunk_buffer[:overlap]) - 1),
            end_overlap_length=sum([len(_) for _ in chunk_buffer[-overlap:]]) + (len(chunk_buffer[-overlap:])- 1),
            file_created_at=file_created_at,
            file_last_updated_at=file_last_updated_at,
        )


class QueryResultType(StrEnum):
    TEXT = 'text'
    IMAGE = 'image'

@dataclass
class QueryResult(AbstractDataClass):
    result_type: QueryResultType

@dataclass
class TextResult(QueryResult):
    distance: float
    result_type: Literal[QueryResultType.TEXT]
    text: str
    begin_chunk_idx: int
    end_chunk_idx: int
    file_download_uri: str
    file_path: str
    file_created_at: str
    file_last_updated_at: str

@dataclass(frozen=True)
class SeenChunk:
    file_path: str
    chunk_idx: int


def _collate_raw_results(raw_query_results, max_results: int, max_allowed_gap: int = 1) -> List[QueryResult]:
    query_results: List[QueryResult] = []
    seen_chunks: Set[SeenChunk] = set()
    for document, metadata, distance in zip(raw_query_results['documents'][0], raw_query_results['metadatas'][0], raw_query_results['distances'][0]):
        chunk_idx = metadata['chunk_index']
        file_path = metadata['file_path']
        seen_chunk = SeenChunk(file_path, chunk_idx)
        if seen_chunk in seen_chunks:
            # This can happen when a chunk gets loaded in when it occupied a gap between
            # other chunks
            continue
        seen_chunks.add(seen_chunk)
        # search for existing results to collate to
        for query_result_idx, query_result in enumerate(query_results):
            if query_result.file_path != file_path:
                continue
            min_chunk_idx = max(query_result.begin_chunk_idx - max_allowed_gap, 0)
            max_chunk_idx = query_result.end_chunk_idx + max_allowed_gap
            if min_chunk_idx > chunk_idx or max_chunk_idx < chunk_idx:
                # Too far from chunk. Continue search.
                continue
            # We have a matching chunk to collate to.
            if query_result.result_type == QueryResultType.IMAGE:
                raise NotImplementedError("No image support yet")
            elif query_result.result_type == QueryResultType.TEXT:
                if chunk_idx == query_result.min_chunk_idx - 1:
                    # We need to prepend found chunk
                    new_query_result = dataclasses.replace(
                        query_result,
                        text=' '.join([document[-metadata['end_overlap_length']:], query_result.text]),
                        begin_chunk_idx=chunk_idx,
                        end_chunk_idx=query_result.end_chunk_idx,
                    )
                    query_results[query_result_idx] = new_query_result
                    break
                elif chunk_idx == query_result.max_chunk_idx + 1:
                    # We need to append found chunk
                    new_query_result = dataclasses.replace(
                        query_result,
                        text=' '.join([query_result, document[:metadata['begin_overlap_length']]]),
                        begin_chunk_idx=query_result.begin_chunk_idx,
                        end_chunk_idx=chunk_idx,
                    )
                    query_results[query_result_idx] = new_query_result
                    break
                elif max_allowed_gap > 0:
                    raise NotImplementedError('Have not implemented gap filling!')
            else:
                raise ValueError("Unexpected query result type")
            raise NotImplementedError("NEED TO IMPLEMENT COLLATION HERE")
            break
        else:
            # No matching chunks to collate to. Add directly to query results.
            query_results.append(TextResult(
                distance=distance,
                result_type=QueryResultType.TEXT,
                text=document,
                begin_chunk_idx=chunk_idx,
                end_chunk_idx=chunk_idx,
                file_download_uri=get_file_download_path(file_path),
                file_path=file_path,
                file_created_at=metadata['file_created_at'],
                file_last_updated_at=metadata['file_last_updated_at']
            ))
    # While this looks inefficient (why not abort early when we've reached `max_results` results?), we do this
    # so that we might get some straggling collations to enhance the first `max_results` results with further
    # context.
    return query_results[:max_results]

def fetch_query_results(query_text: str, max_results: int = 5, max_allowed_collation_gap: int = 0) -> List[QueryResult]:
    raw_query_results = get_collection().query(query_texts=[query_text], n_results=max_results*2)
    query_results = _collate_raw_results(raw_query_results, max_results, max_allowed_gap=max_allowed_collation_gap)
    return query_results


@dataclass
class TextReference:
    file_path: str
    begin_chunk_idx: int
    end_chunk_idx: int


@dataclass
class CitedSentence:
    sentence: str
    text_reference_idx: Optional[int]
    distance: float


Vector = List[float]
ReferenceVectors = List[Vector]


def _vectorize_text_references(text_references: List[TextReference]) -> List[ReferenceVectors]:
    reference_ids: List[List[str]] = [
        [
            f"chunk{chunk_idx}:{reference.file_path}" 
            for chunk_idx in range(
                reference.begin_chunk_idx, 
                reference.end_chunk_idx + 1
            )
        ] 
        for reference in text_references
    ]
    collection = get_collection()
    # This is the slow and stupid N+1 way to do this.
    # If this bottle necks, we could batch fetch these and then
    # re-match the results by reading the `['ids']` entry to match.
    vectors = [
        collection.get([reference_id], include=["embeddings"])['embeddings'][0]
        for reference_id in chain(*reference_ids)
    ]
    unflattened_vectors = []
    for chunk_ids in reference_ids:
        reference_vectors = []
        for _ in chunk_ids:
            reference_vectors.append(vectors.pop(0))
        unflattened_vectors.append(reference_vectors)
    return unflattened_vectors


def _euclidean_distance(v1: Vector, v2: Vector) -> float:
    return math.sqrt(sum((((a-b) ** 2) for a, b in zip(v1, v2))))

def _find_nearest_reference(
        rag_sentence: str, 
        rag_sentence_vector: Vector,
        reference_vectors: List[ReferenceVectors],
    ) -> CitedSentence:
    shortest_distance = math.inf
    reference_index = None
    closest_distances = [
        max([_euclidean_distance(rag_sentence_vector, chunk_vector) for chunk_vector in chunk_vectors])
        for chunk_vectors in reference_vectors
    ]
    for ref_index, distance in enumerate(closest_distances):
        if distance < shortest_distance:
            shortest_distance = distance
            reference_index = ref_index
    return CitedSentence(
        sentence=rag_sentence,
        text_reference_idx=reference_index,
        distance=shortest_distance
    )


def add_citations_to_rag_response(rag_response: str, text_references: List[TextReference]) -> List[CitedSentence]:
    chunked_rag_response = list(filter(lambda s: s != '', _sentence_chunk_text(rag_response)))
    vectorized_response_sentences = AinekoEmbeddingFunction()(chunked_rag_response)
    reference_vectors = _vectorize_text_references(text_references)
    return [
        _find_nearest_reference(
            rag_sentence=rag_sentence,
            rag_sentence_vector=rag_sentence_vector,
            reference_vectors=reference_vectors
        )
        for rag_sentence, rag_sentence_vector in zip(chunked_rag_response, vectorized_response_sentences)
    ]
