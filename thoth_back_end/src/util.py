from abc import ABC
from dataclasses import dataclass
import urllib.parse

@dataclass
class AbstractDataClass(ABC):
    def __new__(cls, *args, **kwargs): 
        if cls == AbstractDataClass or cls.__bases__[0] == AbstractDataClass: 
            raise TypeError("Cannot instantiate abstract class.") 
        return super().__new__(cls)

def get_file_download_path(file_path: str):
    escaped_path = urllib.parse.quote(file_path)
    return f'/file/{escaped_path}'
