# AINEKO
If your intent is to use Thoth, please leave this directory and run Thoth's front end instead. It automatically handles installing the aineko.

AINEKO is a dataset embedding storage and retrieval implementation for RAG (retrieval augmented generation) systems. In addition to indexing the data itself, it strategically indexes metadata, summaries, and other bits of information that augment the retrieval process and fix a lot of the downfalls that come with storing embeddings of chunks of data naively.

## Running the backend headlessly
```
# Create a virtual environment
$ python -m venv .venv

# Activate virtual environment
# Unix machines:
$ source .venv/Scripts/activate
# Windows machines:
$ .venv/Scripts/activate

# Install requirments
(.venv) $ pip install -r requirements.txt

# Run as a server
(.venv) $ python src/main.py --server

```

## Endpoints

### `POST /add-dir`
This endpoint allows you to specify a directory to be recursively ingested into `aineko`'s embedding database
- Expects: JSON in body of the format:
  - 'dir_to_add': a string of the directory you'd like to have recursively ingested for indexing by `aineko`
- Returns: JSON in the format:
  - 'files_added': List of strings of paths of files ingested by `aineko`

### `POST /query`
This endpoint allows you to send a query to be matched by nearest embeddings.
- Expects: JSON in body of the format:
  - `query`: string query
- Returns: JSON in the format:
  - `query_results`: a list of:
    - `distance`: float
    - `result_type`: `"text"` or `"image"`
    - `file_created_at`: string
    - `file_last_updated_at`: string
    - `file_download_uri`: string (send a GET here to download full file contents)
    - `file_path`: string (path to file on disk)
    - For `text` results:
        - `begin_chunk_idx`: int (inclusive)
        - `end_chunk_idx`: int (inclusive)
        - `text`: string of result chunk
    - For `image` results:
        - Unimplemented.

### `POST /inject_citations`
This endpoint receives references to text from the indexed corpus as well as the RAG response text. It splits the response text into approximate sentence chunks. For each chunk, it returns the index of text reference which is semantically closest to the sentence as well as the distance of the reference.
- Excpects: JSON in body of the format:
  - `rag_response_text`: string
  - `text_references`: a list of:
    - `file_path`: string
    - `begin_chunk_idx`: int (inclusive)
    - `end_chunk_idx`: int (inclusive)
- Returns: JSON in the format:
  - `cited_sentences`: a list of:
    - `sentence`: str of the original sentence
    - `text_reference_idx`: zero-indexed reference to the text references passed above which is semantically closest to the sentence
    - `distance`: float representing the semantic distance
Note that the sentence chunking is lossy in that the white space between sentences is lost, so full reconstruction of response is not recommended using the results of this endpoint.

### `GET file/*`
Downloads the file specified at `*`. Must be a URL encoded absolute path.

### `GET /`
nyaa!
