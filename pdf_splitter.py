"""
PDF Splitter & Renamer (Python Script)
Agar aap PC par direct Python se split karna chahte hain to is script ka use kar sakte hain.

Requirements:
    pip install pypdf

Usage:
    python pdf_splitter.py
"""

import os
import math

def split_pdf(
    input_pdf_path,
    chunk_size=20,
    start_page=1,
    end_page=None,
    reset_numbering=True,
    naming_style="book_part",
    custom_book_name=None,
    output_dir="output_parts"
):
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError:
        print("Please install pypdf: pip install pypdf")
        return

    reader = PdfReader(input_pdf_path)
    total_doc_pages = len(reader.pages)
    print(f"Loaded: {input_pdf_path}")
    print(f"Total Pages: {total_doc_pages}")

    effective_start = max(1, min(start_page, total_doc_pages))
    effective_end = total_doc_pages if end_page is None else min(end_page, total_doc_pages)

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    book_name = custom_book_name or os.path.splitext(os.path.basename(input_pdf_path))[0]
    book_name = book_name.replace(" ", "_")

    current = effective_start
    part_index = 1
    total_parts = math.ceil((effective_end - effective_start + 1) / chunk_size)

    while current <= effective_end:
        chunk_end = min(current + chunk_size - 1, effective_end)
        writer = PdfWriter()

        for p_idx in range(current - 1, chunk_end):
            writer.add_page(reader.pages[p_idx])

        # Page numbering
        log_start = (current - effective_start + 1) if reset_numbering else current
        log_end = (chunk_end - effective_start + 1) if reset_numbering else chunk_end

        if naming_style == "book_part":
            out_name = f"{book_name}_Part_{part_index}.pdf"
        elif naming_style == "book_pages":
            out_name = f"{book_name}_Pages_{log_start}-{log_end}.pdf"
        else:
            out_name = f"{book_name}_Part_{part_index}_p{log_start}-p{log_end}.pdf"

        out_path = os.path.join(output_dir, out_name)
        with open(out_path, "wb") as f:
            writer.write(f)

        print(f"Created: {out_name} (Physical p{current}-{chunk_end} -> Logical p{log_start}-{log_end})")
        current = chunk_end + 1
        part_index += 1

    print(f"\nDone! All {part_index - 1} parts saved to '{output_dir}' folder.")

if __name__ == "__main__":
    print("=== PDF Splitter & Renamer ===")
    pdf_path = input("Enter PDF file path: ").strip().strip('"')
    if os.path.exists(pdf_path):
        c_size = input("Enter chunk size (default 20): ").strip()
        c_size = int(c_size) if c_size.isdigit() else 20

        s_page = input("Start from page (default 1): ").strip()
        s_page = int(s_page) if s_page.isdigit() else 1

        b_name = input("Custom Book Name (press enter for default): ").strip() or None

        split_pdf(
            input_pdf_path=pdf_path,
            chunk_size=c_size,
            start_page=s_page,
            reset_numbering=True,
            custom_book_name=b_name
        )
    else:
        print(f"File not found: {pdf_path}")
