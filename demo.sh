#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -ne 2 ]; then
    echo "Hi. Please provide source store and target store as arguments."
    exit 1
fi


FROM_STORE="$1"
TO_STORE="$2"


# generate a unique name for the export file
EXPORT_FILE="export-$(date +%Y%m%d%H%M%S).sqlite"

clear

echo
echo "copying data from $FROM_STORE to $TO_STORE"
echo "shopify store copy --from-store=$FROM_STORE --to-store=$TO_STORE -y"
shopify store copy --from-store=$FROM_STORE --to-store=$TO_STORE -y

echo "now exporting data from $TO_STORE to a file"
echo "shopify store copy --from-store=$TO_STORE --to-file=$EXPORT_FILE -y"
shopify store copy --from-store=$TO_STORE --to-file=$EXPORT_FILE -y

echo "now updating the data in the file so all products are upper case"

# update all the product titles to be upper case
# in the sqlite file products table
sqlite3 $EXPORT_FILE <<EOF
    UPDATE products SET title = UPPER(title);
EOF

echo "now importing the modified data back to the store"
echo "shopify store copy --to-store=$TO_STORE --from-file=$EXPORT_FILE -y"
shopify store copy --to-store=$TO_STORE --from-file=$EXPORT_FILE -y

# download again
echo "now exporting the data again to verify the titles are upper case"
echo "shopify store copy --from-store=$TO_STORE --to-file=$EXPORT_FILE -y"
shopify store copy --from-store=$TO_STORE --to-file=$EXPORT_FILE -y


echo "now checking if all product titles are upper case"
if sqlite3 $EXPORT_FILE "SELECT title FROM products WHERE title != UPPER(title);" | grep -q .; then
    echo "Boo! Product titles are not upper case"
    exit 1
else
    echo "Product titles are upper case. Huzzah!"
fi

echo "done!"
