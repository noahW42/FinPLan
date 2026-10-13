from cryptography.fernet import Fernet
import os

fernet = Fernet(os.environ["FERNET_KEY"])

def encrypt(value: str) -> str:
    return fernet.encrypt(value.encode()).decode()

def decrypt(value: str) -> str:
    return fernet.decrypt(value.encode()).decode()