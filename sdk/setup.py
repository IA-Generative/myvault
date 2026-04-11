from setuptools import setup, find_packages

setup(
    name="myvault-client",
    version="1.0.0",
    description="Python SDK for MyVault — credential vault for the MirAI ecosystem",
    author="Fabrique Numérique",
    license="Apache-2.0",
    packages=find_packages(),
    python_requires=">=3.10",
    install_requires=[
        "httpx>=0.25.0",
    ],
    extras_require={
        "dev": ["pytest", "pytest-asyncio", "respx"],
    },
)
