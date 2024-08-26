""" Build script for thoth back end executable.

    Must be run from within the virtual environment.
"""
import importlib.util
from pathlib import Path
import subprocess
import os
import sys
from chromadb.config import Settings

# Dynamically import what we need from the codebase
aineko_module_path = Path("src/aineko.py").resolve()
try:
    sys.path.insert(0, str(Path(aineko_module_path).parent.resolve()))
    aineko_import_spec = importlib.util.spec_from_file_location("aineko", aineko_module_path)
    aineko = importlib.util.module_from_spec(aineko_import_spec)
    aineko_import_spec.loader.exec_module(aineko)
finally:
    sys.path.pop(0)

def collect_hidden_imports():
    # Initialize the list to hold strings for hidden imports. Some are not detected automatically
    # and so are included here manually
    hidden_imports = [
        'chromadb',
        'chromadb.migrations',
        'chromadb.migrations.embeddings_queue'
    ]

    # Get members of the Settings class
    settings_instance = Settings()
    for name, type_hint in settings_instance.__annotations__.items():
        value = getattr(settings_instance, name, None)
        # Check if the member name ends with '_impl' and if the value is a string or None
        if name.endswith('_impl') and isinstance(value, str):
            # Remove the module instance from the import and import just the module itself
            value = '.'.join(value.split('.')[:-1])
            hidden_imports.append(value)

    return hidden_imports

def get_pip_executable():
    if os.name == 'nt':
        return os.path.join('.venv', 'Scripts', 'pip.exe')
    else:
        return os.path.join('.venv', 'bin', 'pip')

def get_pyinstaller_executable():
    if os.name == 'nt':
        pyinstaller_path = os.path.join('.venv', 'Scripts', 'pyinstaller.exe')
    else:
        pyinstaller_path = os.path.join('.venv', 'bin', 'pyinstaller')
    if not os.path.exists(pyinstaller_path):
        print("PyInstaller is not, uh... installed. Installing PyInstaller. We have to go deeper.")
        subprocess.run([get_pip_executable(), 'install', 'pyinstaller'], check=True)
    return pyinstaller_path


def run_pyinstaller(hidden_imports):
    # Preload punkt tokenizer so we can copy it into the executeable as a resource
    punkt_path = aineko.load_punkt_tokenizer()
    # Start building the pyinstaller command
    command = [
        get_pyinstaller_executable(), os.path.join('src', 'main.py'), 
        '--noconfirm', 
        '--add-data', f'{punkt_path}:{punkt_path}'
    ]

    # Add hidden import flags
    for impl in hidden_imports:
        command.append(f'--collect-all={impl}')

    # Run the pyinstaller command
    print("Running command:", ' '.join(command))
    subprocess.run(command, check=True)

if __name__ == "__main__":
    # Collect all hidden imports
    hidden_imports = collect_hidden_imports()

    # Run pyinstaller with the collected hidden imports
    run_pyinstaller(hidden_imports)

    exit()
