#!/bin/bash

# Default number of rows to add if no argument provided
NUM_ROWS=${1:-5}

# Validate input is a positive number
if ! [[ "$NUM_ROWS" =~ ^[0-9]+$ ]] || [ "$NUM_ROWS" -eq 0 ]; then
    echo "Error: Please provide a positive number of rows to add"
    echo "Usage: $0 [number_of_rows]"
    echo "Example: $0 10"
    exit 1
fi

# Database file
DB_FILE="large.sqlite"

# Check if database exists
if [ ! -f "$DB_FILE" ]; then
    echo "Error: Database file '$DB_FILE' not found"
    exit 1
fi

echo "Adding $NUM_ROWS new rows to the products table..."

# Add the specified number of rows
for i in $(seq 1 $NUM_ROWS); do
    sqlite3 "$DB_FILE" <<EOF
INSERT INTO products (
    shopifyId,
    handle,
    title,
    status,
    vendor,
    productType,
    descriptionHtml,
    giftCard,
    giftCardTemplateSuffix,
    options,
    "productCategory.productTaxonomyNodeId",
    publishedToOnlineStore,
    "seo.title",
    "seo.description",
    requiresSellingPlan,
    tags,
    templateSuffix
)
SELECT 
    NULL,
    'handle-' || (SELECT MAX(id) + 1 FROM products),
    'row-' || (SELECT MAX(id) + 1 FROM products),
    status,
    vendor,
    productType,
    descriptionHtml,
    giftCard,
    giftCardTemplateSuffix,
    options,
    "productCategory.productTaxonomyNodeId",
    publishedToOnlineStore,
    "seo.title",
    "seo.description",
    requiresSellingPlan,
    tags,
    templateSuffix
FROM products
WHERE id = (SELECT MAX(id) FROM products);
EOF
done

# Show the new row count
NEW_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM products;")
echo "Success! The products table now has $NEW_COUNT rows."

# Show the last few rows added
echo -e "\nLast 3 rows added:"
sqlite3 "$DB_FILE" -header -column "SELECT id, handle, title FROM products ORDER BY id DESC LIMIT 3;"