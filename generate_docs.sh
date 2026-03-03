#!/bin/bash
echo "Analyzing project structure..."
find streamlive-pro/src -type f -name "*.ts" -o -name "*.vue" | sort > src_files.txt
cat src_files.txt
