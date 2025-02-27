---
created: 2023-03-21T07:46:39-07:00
modified: 2023-03-21T07:48:41-07:00
---

# XOR tool

import sys
import os

def xor_files(input_file1, input_file2, output_file):
    with open(input_file1, 'rb') as f1, open(input_file2, 'rb') as f2, open(output_file, 'wb') as out:
        chunk_size = 1024

        while True:
            chunk1 = f1.read(chunk_size)
            chunk2 = f2.read(chunk_size)

            if not chunk1 and not chunk2:
                break

            if len(chunk1) < chunk_size:
                chunk1 += b'\x00' * (chunk_size - len(chunk1))

            if len(chunk2) < chunk_size:
                chunk2 += b'\x00' * (chunk_size - len(chunk2))

            xor_chunk = bytes(a ^ b for a, b in zip(chunk1, chunk2))
            out.write(xor_chunk)

def is_parity_file(filename):
    basename, _ = os.path.splitext(os.path.basename(filename))
    return basename.endswith("_parity")

def generate_parity_filename(file1, file2):
    basename1, _ = os.path.splitext(os.path.basename(file1))
    basename2, _ = os.path.splitext(os.path.basename(file2))
    return f"{basename1}_{basename2}_parity.stripe"

def generate_recovery_filename(input_file, parity_file):
    input_basename, _ = os.path.splitext(os.path.basename(input_file))
    parity_basename, _ = os.path.splitext(os.path.basename(parity_file))
    missing_file_basename = parity_basename.replace(f"{input_basename}_", "")
    missing_file_basename = missing_file_basename.replace("_parity.stripe", "")
    return f"{missing_file_basename}.recovered"

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python xor_tool.py <input_file1> <input_file2>")
        sys.exit(1)

    input_file1 = sys.argv[1]
    input_file2 = sys.argv[2]

    if is_parity_file(input_file1):
        output_file = generate_recovery_filename(input_file2, input_file1)
    elif is_parity_file(input_file2):
        output_file = generate_recovery_filename(input_file1, input_file2)
    else:
        output_file = generate_parity_filename(input_file1, input_file2)

    xor_files(input_file1, input_file2, output_file)
    print("Output file created:", output_file)
