import os

from flask import Flask, abort, send_from_directory, request, redirect
from flask_json import FlaskJSON, JsonError, as_json

from aineko import (
    add_citations_to_rag_response,
    add_dir_to_collection, 
    fetch_query_results, 
    TextReference,
)
from util import get_file_download_path

app = Flask(__name__)
json = FlaskJSON(app)

@app.route("/")
def hello_world():
    return f'<code>nyaa! I will find chunks of your files for you :3 <a href="/help">help</a></code>'

@app.route("/help", methods=['GET'])
def help():
    cwd = os.getcwd()
    relative_path = "../README.md"
    full_path = os.path.join(cwd, relative_path)
    return redirect(get_file_download_path(full_path))

@app.route('/add-dir', methods=['POST'])
@as_json
def add_dir():
    data = request.get_json(force=True)
    dir_to_add = data.get('dir_to_add', None)
    if not dir_to_add:
        raise JsonError("Missing `dir_to_add` key")
    return {
        "files_added": add_dir_to_collection(dir_to_add)
    }

@app.route('/query', methods=['POST'])
@as_json
def query():
    data = request.get_json(force=True)
    query_text = data.get('query', None)
    if not query_text:
        raise JsonError("Missing `query` key")
    query_results = fetch_query_results(query_text)
    return { "query_results": query_results }

@app.route('/file/<path:file_path>', methods=['GET'])
def get_file(file_path):
    if not os.path.exists(file_path):
        abort(404)
    return send_from_directory(os.path.dirname(file_path), os.path.basename(file_path))

@app.route('/inject_citations', methods=['POST'])
@as_json
def inject_citations():
    data = request.get_json(force=True)
    text_references_raw = data.get('text_references', None)
    rag_response_text = data.get('rag_response_text', None)
    if text_references_raw is None or rag_response_text is None:
        raise JsonError('Both `text_references` and `rag_response_text` must be defined')
    text_references = [TextReference(**_) for _ in text_references_raw]
    cited_sentences = add_citations_to_rag_response(rag_response=rag_response_text, text_references=text_references)
    return { "cited_sentences": cited_sentences }
