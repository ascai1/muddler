#!/usr/bin/python3
import argparse
import sys

from muddler.core import (
    parse_file, permute, print_muddle_groups,
    INTERVAL_FORMAT, DEGREE_FORMAT, DEGREE_AND_INTERVAL_FORMAT, SW_FORMAT,
)


def main():
    parser = argparse.ArgumentParser(description="Xenharmonic muddle generator")
    parser.add_argument("positional_filename", nargs="?")
    parser.add_argument("-f", "--filename", help="Input file path.")
    parser.add_argument(
        "--show-context",
        action="store_true",
        help="Show output explaining how each muddle is derived.",
    )
    parser.add_argument(
        "--initial-index",
        type=int,
        choices=[0, 1],
        default=1,
        help="Set the starting index (0 or 1). Default is 1.",
    )
    parser.add_argument(
        "--format",
        choices=[INTERVAL_FORMAT, DEGREE_FORMAT, DEGREE_AND_INTERVAL_FORMAT, SW_FORMAT],
        default=DEGREE_FORMAT,
        help="Output formatting style.",
    )
    parser.add_argument(
        "--context-format",
        choices=[INTERVAL_FORMAT, DEGREE_FORMAT, DEGREE_AND_INTERVAL_FORMAT, SW_FORMAT],
        default=None,
        help="Formatting style for context output (defaults to --format).",
    )

    args = parser.parse_args()
    filename = args.filename or args.positional_filename
    if not filename:
        parser.error("Filename must be provided")

    if filename in ("stdin", "-"):
        scale_input = parse_file(sys.stdin, initial_index=args.initial_index)
    else:
        with open(filename) as fh:
            scale_input = parse_file(fh, initial_index=args.initial_index)

    muddle_groups = permute(scale_input)
    print_muddle_groups(
        muddle_groups,
        initial_index=args.initial_index,
        show_context=args.show_context,
        output_format=args.format,
        context_format=args.context_format,
    )


if __name__ == "__main__":
    main()
