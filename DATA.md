# PersLM Data Sources and Processing

This document describes the data sources, processing pipeline, and usage for the PersLM project.

## Data Sources

### Currently Supported

1. **Local Text Files**
   - Text files (`.txt`) in a specified directory
   - Each file is processed into chunks of appropriate length
   - Usage: `--input_dir path/to/text/files`

2. **HuggingFace Datasets**
   - Any dataset available through the HuggingFace Datasets Hub
   - Configurable to use specific splits and text fields
   - Usage: `--hf_dataset dataset_name --hf_split split_name --hf_text_field field_name`

### Recommended Datasets for Fine-tuning

1. **OpenOrca** (`Open-Orca/OpenOrca`)
   - High-quality instruction-following dataset derived from various sources
   - Suitable for general instruction tuning

2. **Dolly** (`databricks/dolly-15k`)
   - High-quality instruction dataset created by Databricks
   - Good for business and analytical tasks

3. **WebGPT Comparisons** (`openai/webgpt_comparisons`)
   - Dataset of human preferences about model outputs
   - Useful for alignment fine-tuning

4. **Personal Data**
   - User-specific documents, notes, and communications
   - Provides personalization for the model
   - Store in `data/personal` (not included in repository)

## Data Processing Pipeline

The data processing pipeline includes the following steps:

1. **Loading**: Data is loaded from various sources (local files, HuggingFace, etc.)
2. **Cleaning**: Text is cleaned to remove artifacts, fix spacing, etc.
3. **Chunking**: Long texts are split into chunks of appropriate length
4. **Filtering**: Chunks below a minimum length are filtered out
5. **Splitting**: Data is split into training and evaluation sets
6. **Saving**: Processed data is saved in JSONL format
7. **Statistics**: Dataset statistics are generated and saved for reference

## Usage Examples

### Prepare a Sample Dataset

```bash
python scripts/prepare_data.py \
  --output_dir data/sample \
  --hf_dataset "Open-Orca/OpenOrca" \
  --hf_split "train" \
  --hf_text_field "question" \
  --max_samples 1000 \
  --min_length 50 \
  --max_length 2048 \
  --train_ratio 0.9
```

### Process Local Text Files

```bash
python scripts/prepare_data.py \
  --input_dir data/personal \
  --output_dir data/processed \
  --min_length 100 \
  --max_length 4096
```

### Combine Multiple Sources

```bash
# First process one source
python scripts/prepare_data.py \
  --hf_dataset "databricks/dolly-15k" \
  --output_dir data/combined \
  --min_length 50 \
  --max_length 2048

# Then process another and append
python scripts/prepare_data.py \
  --input_dir data/personal \
  --output_dir data/combined \
  --min_length 50 \
  --max_length 2048
```

## Data Format

The processed data is stored in JSONL format with the following structure:

```json
{"text": "This is an example text chunk that will be used for training."}
```

Future versions may include additional fields such as:
- `metadata`: Source information, processing details, etc.
- `tags`: Categorization or labeling information
- `embedding`: Pre-computed embeddings for efficient retrieval

## Dataset Statistics

For each processed dataset, statistics are saved in a `dataset_stats.json` file with the following information:

- Source information (type, path, count)
- Number of original samples
- Number of processed chunks
- Processing parameters (min/max length, train ratio, etc.)

## Future Enhancements

1. **Data Versioning**: Track changes to datasets over time
2. **Data Augmentation**: Generate variations of existing data
3. **Quality Scoring**: Automatically score and filter data by quality
4. **Multi-modal Support**: Process and store images, audio, etc.
5. **Efficient Storage**: Compression and deduplication for large datasets 