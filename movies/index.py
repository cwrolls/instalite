import pandas as pd
from tqdm import tqdm
import openai
import os
import chromadb
from chromadb import HttpClient
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction
from dotenv import load_dotenv

load_dotenv()

openai_api_key = os.getenv("OPENAI_API_KEY")

df = pd.read_csv("merged_data.csv").fillna("")

def row_to_text(row):
    return (
        f"Movie: {row['primaryTitle']} | "
        f"Actor: {row['primaryName']} | "
        f"Role: {row['characters']} | "
        f"Category: {row['category']} | "
        f"Rating: {row['averageRating']} | "
        f"Year: {row['startYear']} | "
        f"Runtime: {row['runtimeMinutes']} mins"
    )

print("Loaded CSV")

texts = df.apply(row_to_text, axis=1).tolist()
print("Applied row to text")

metadatas = df.to_dict(orient='records')
print("Applied metadata")

chroma_client = HttpClient(host="3.237.70.182", port=8000)
print("Connected to ChromaDB")

collection_name = "actor_embeddings"
embedding_function = OpenAIEmbeddingFunction(
    api_key=openai_api_key,
    model_name="text-embedding-3-small"
)

chroma_client.delete_collection(name=collection_name)

collection = chroma_client.get_or_create_collection(
    name=collection_name,
    embedding_function=embedding_function
)
print("Got Collection")

print(f"Embedding {len(texts)} records in batches...")
batch_size = 100
for i in tqdm(range(0, len(texts), batch_size)):
    batch_texts = texts[i:i+batch_size]
    batch_metadatas = metadatas[i:i+batch_size]
    batch_ids = [f"entry-{j}" for j in range(i, i + len(batch_texts))]
    collection.add(
        documents=batch_texts,
        metadatas=batch_metadatas,
        ids=batch_ids
    )

print("✅ Done embedding all rows into ChromaDB.")