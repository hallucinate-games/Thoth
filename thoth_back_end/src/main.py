import argparse
from pprint import pprint
import sys

from aineko import add_dir_to_collection, add_file_to_collection, create_collection, fetch_query_results 
from server import app


def main():
    parser = argparse.ArgumentParser(description="Smart embedding vector storage and retrieval")

    parser.add_argument('--file', help="A file to store the embeddings of.")
    parser.add_argument('--dir', help="Recursively store embeddings of files in this directory.")
    parser.add_argument('--query', help="Run this embedding search and output results")
    parser.add_argument('--server', help="Run aineko in server mode", action='store_true')

    args = parser.parse_args()

    file_to_add = getattr(args, 'file', None)
    dir_to_add = getattr(args, 'dir', None)
    query = getattr(args, 'query', None)
    server_mode = getattr(args, 'server', False)

    if not (file_to_add or dir_to_add or query or server_mode):
        parser.print_help()
        sys.exit(1)
    
    create_collection()
    if file_to_add:
        add_file_to_collection(file_path=file_to_add)
    if dir_to_add:
        add_dir_to_collection(dir=dir_to_add)
    if query:
        query_results = fetch_query_results(query)
        pprint(query_results)
    if server_mode:
        app.run(debug=True)

if __name__ == "__main__":
    main()
