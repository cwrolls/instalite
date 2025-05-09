import chromadb
import sys

try:
    # Connect to the locally running ChromaDB server from the host
    client = chromadb.HttpClient(host='localhost', port=8000)
    print("Attempting to connect and get/create test collection...")
    # This operation usually ensures the default tenant/database exists
    collection = client.get_or_create_collection("init_test_collection")
    print(f"Successfully got or created collection '{collection.name}'.")
    print("Default tenant should now exist.")
    # Clean up the test collection (optional)
    # client.delete_collection("init_test_collection")
    # print("Cleaned up test collection.")
    sys.exit(0) # Exit with success code
except Exception as e:
    print(f"Error during ChromaDB initialization test: {e}")
    print("Ensure ChromaDB server is running on http://localhost:8000")
    sys.exit(1) # Exit with error code