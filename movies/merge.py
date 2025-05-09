import pandas as pd

def safe_read_tsv(file_path):
    try:
        return pd.read_csv(file_path, sep='\t', dtype=str).fillna("")
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return pd.DataFrame()

names_df = safe_read_tsv("names.tsv")
principals_df = safe_read_tsv("principals.tsv")
ratings_df = safe_read_tsv("ratings.tsv")
titles_df = safe_read_tsv("titles.tsv")

principals_filtered = principals_df[principals_df['category'].isin(['actor', 'actress'])]

actor_movies = principals_filtered.merge(
    names_df,
    how='left',
    on='nconst',
    suffixes=('', '_name')
)

actor_movies = actor_movies.merge(
    ratings_df,
    how='left',
    on='tconst',
    suffixes=('', '_rating')
)

actor_movies = actor_movies.merge(
    titles_df,
    how='left',
    on='tconst',
    suffixes=('', '_title')
)

actor_movies.to_csv("merged_data.csv", index=False)