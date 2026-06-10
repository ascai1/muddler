#!/usr/bin/python3
import argparse
import re
import sys
import itertools
from dataclasses import dataclass
from fractions import Fraction
from collections import defaultdict
import math


DEGREES_TOKENS = ['degrees', 'positions', 'keys']
INTERVALS_TOKENS = ['intervals', 'steps']
ON_OFF_TOKENS = ['onoff', 'binary']
DEGREES = DEGREES_TOKENS[0]
INTERVALS = INTERVALS_TOKENS[0]
ON_OFF = ON_OFF_TOKENS[0]
LOCKED = 'locked'

INTERVAL_FORMAT = 'intervals'
DEGREE_FORMAT = 'degrees'
DEGREE_AND_INTERVAL_FORMAT = 'degrees_and_intervals'
SW_FORMAT = 'sw'


@dataclass
class InputScale:
  scale: tuple[int]
  edo: int
  locked: bool


@dataclass
class Input:
  scales: list[InputScale]
  edo: int
  input_type: str


@dataclass
class Mode:
  scale: InputScale
  edo: int
  mode: tuple[int]
  root_degree: int
  root_mos_degree: int


@dataclass
class Muddle:
  scale: tuple[int]
  edo: int
  degrees: tuple[int]
  intervals: tuple[int]
  modes: list[Mode]


def parse_args():
  parser = argparse.ArgumentParser()
  parser.add_argument("positional_filename", nargs="?")
  parser.add_argument("-f", "--filename", help="Input file path.")
  parser.add_argument(
    "--show-context",
    action="store_true",
    help="Show output explaining how each muddle is derived."
  )
  parser.add_argument(
    "--initial-index",
    type=int,
    choices=[0, 1],
    default=1,
    help="Set the starting index (0 or 1). Default is 1.",
  )
  parser.add_argument(
    '--format',
    choices=[INTERVAL_FORMAT, DEGREE_FORMAT, DEGREE_AND_INTERVAL_FORMAT, SW_FORMAT],
    default=INTERVAL_FORMAT,
    help='Specify the output formatting style, showing each muddle as a list of intervals, EDO degrees, both, or in Scale Workshop compatible format.'
  )
  args = parser.parse_args()
  filename = args.filename if args.filename else args.positional_filename
  if not filename:
    parser.error("Filename must be provided")
  args.filename = filename
  return args


def convert_tokens_to_binary(tokens, edo):
  if len(tokens) > edo:
    print(f"WARN: Processing {len(tokens)} tokens {tokens} in {edo} EDO space", file=sys.stderr)
  scale = [0] * edo
  tokens = tokens[:edo]
  scale[:len(tokens)] = tokens
  return tuple(scale)


def convert_intervals_to_binary(intervals, edo):
  if sum(intervals) > edo:
    print(f"WARN: Processing intervals {intervals} (sum {sum(intervals)}) in {edo} EDO space", file=sys.stderr)
  scale = [0] * edo
  degree = 0
  scale[degree] = 1
  for interval in intervals:
    degree += interval
    scale[degree % edo] = 1
  return tuple(scale)


def convert_degrees_to_binary(degrees, edo):
  if max(degrees) > edo:
    print(f"WARN: Processing degrees {degrees} in {edo} EDO space", file=sys.stderr)
  scale = [0] * edo
  for degree in degrees:
    if scale[degree % edo]:
      print(f"WARN: Degree {degree} specified multiple times in {edo} EDO space", file=sys.stderr)
    scale[degree % edo] = 1
  return tuple(scale)


def convert_binary_to_degrees(scale):
  return tuple(degree for degree, is_on in enumerate(scale) if is_on)


def convert_degrees_to_intervals(degrees, edo):
  degree_pairs = zip(degrees, degrees[1:] + (degrees[0],))
  return tuple((b + edo - a) % edo for a, b in degree_pairs)


def parse_scale(line, edo, input_type=None, initial_index=1):
  locked = False
  tokens = []
  for token in line.split():
    if LOCKED.startswith(token.lower()):
      locked = True
    else:
      token = re.sub(r"\\", "/", token)
      token = re.sub(r"[^\d./]", "", token)
      tokens.append(Fraction(token))

  lcm = math.lcm(*(token.denominator for token in tokens))
  tokens = [int(token.numerator * lcm / token.denominator) for token in tokens]
  if input_type is None:
    if every(token <= 1 for token in tokens):
      input_type = ON_OFF
    elif sum(tokens) <= edo:  # just a heuristic
      input_type = INTERVALS
    else:
      input_type = DEGREES

  if input_type in ON_OFF_TOKENS:
    scale = convert_tokens_to_binary(tokens, edo)
  elif input_type in INTERVALS_TOKENS:
    scale = convert_intervals_to_binary(tokens, edo)
  else:
    scale = convert_degrees_to_binary([token - initial_index for token in tokens], edo)
  
  return InputScale(scale=scale, edo=edo, locked=locked)


def parse_edo(token):
  edo = re.search('\d+', token)
  if not edo:
    raise Exception('EDO size must be numeric')
  return int(edo.group(0))


def parse_input_type(token):
  token = re.sub(r"[^a-z]", "", token.lower())
  for input_type_tokens in (DEGREES_TOKENS, INTERVALS_TOKENS, ON_OFF_TOKENS):
    if any(input_type_token.startswith(token) for input_type_token in input_type_tokens):
      return input_type_tokens[0]
  return None


def parse_header(line):
  tokens = line.split()
  if not tokens:
    raise Exception('No EDO size provided')
  return (parse_edo(tokens[0]), parse_input_type(tokens[-1]) if len(tokens) > 1 else None)


def parse_file(f, initial_index=1):
  (edo, input_type) = (None, None)
  scales = []
  next_edo = edo
  for line in f:
    line = line.strip()
    if not line or line.startswith('#'):
      continue
    if edo is None or input_type is None:
      (edo, input_type) = parse_header(line)
      next_edo = edo
    else:
      scale = parse_scale(line, next_edo, input_type, initial_index)
      scales.append(scale)
      next_edo = sum(scale.scale)
  return Input(scales=scales, edo=edo, input_type=input_type)


def create_muddle(modes):
  edo = modes[0].edo
  degrees = convert_binary_to_degrees(modes[0].mode)
  for mode in modes[1:]:
    degrees = [outer_degree for inner_degree, outer_degree in enumerate(degrees) if mode.mode[inner_degree]]
  degrees = tuple(degrees)
  scale = convert_degrees_to_binary(degrees, edo)
  intervals = convert_degrees_to_intervals(degrees, edo)
  return Muddle(scale=scale, edo=edo, degrees=degrees, modes=modes, intervals=intervals)


def generate_modes(scale, locked=False):
  if locked:
    yield Mode(scale=scale, edo=scale.edo, mode=scale.scale, root_degree=0, root_mos_degree=0)
    return
  for root_degree in range(scale.edo):
    if not scale.scale[root_degree]:
      continue
    mode = tuple(scale.scale[root_degree:] + scale.scale[:root_degree])
    if root_degree > 0 and mode == scale.scale:
      break
    root_mos_degree = sum(scale.scale[:root_degree])
    yield Mode(scale=scale, edo=scale.edo, mode=mode, root_degree=root_degree, root_mos_degree=root_mos_degree)


def get_min_rotation(degrees):
  double_degrees = degrees + degrees
  n = len(degrees)
  return min((tuple(double_degrees[i:i+n]), (n-i) % n) for i in range(n))


def permute(scale_input):
  muddles = []
  for modes in itertools.product(*(generate_modes(scale, locked=scale.locked) for scale in scale_input.scales)):
    muddle = create_muddle(modes)
    muddles.append(muddle)
  muddles.sort(key=lambda muddle: muddle.intervals)
  muddle_groups = defaultdict(lambda: defaultdict(list))
  for muddle in muddles:
    (key, order) = get_min_rotation(muddle.intervals)
    muddle_groups[key][order].append(muddle)
  return muddle_groups


def print_muddle(muddle, initial_index=1, output_format=None):
  if output_format == DEGREE_FORMAT:
    print(list(degree + initial_index for degree in muddle.degrees))
  elif output_format == SW_FORMAT:
    for degree in muddle.degrees:
      print(f"{degree + initial_index}\\{muddle.edo}")
  elif output_format == DEGREE_AND_INTERVAL_FORMAT:
    degrees = list(degree + initial_index for degree in muddle.degrees)
    print(f"{degrees} {muddle.intervals}")
  else:
    print(list(muddle.intervals))
  

def print_muddle_groups(muddle_groups, initial_index=1, show_context=False, output_format=None):
  i = 1
  for key, muddle_group in muddle_groups.items():
    print(f"Group {i}: {key}")
    i += 1
    for order, muddles in sorted(muddle_group.items()):
      print()
      print_muddle(muddles[0], initial_index=initial_index, output_format=output_format)
      if show_context:
        print("Context:")
        for muddle in muddles:
          print(" -")
          for mode in muddle.modes:
            mode_degrees = list(degree + initial_index for degree in convert_binary_to_degrees(mode.mode))
            scale_degrees = list(degree + initial_index for degree in convert_binary_to_degrees(mode.scale.scale))
            root_degree = mode.root_degree + initial_index
            root_mos_degree = mode.root_mos_degree + initial_index
            print(f"    {mode_degrees} (degree {root_degree} / mode {root_mos_degree} of scale {scale_degrees})")
    print()
    print('-'*8)
    print()


def main(filename, initial_index=1, show_context=False, output_format=None):
  filename = sys.argv[1] if len(sys.argv) > 1 else 'stdin'
  if filename and filename not in ('stdin', '-'):
    with open(filename) as file:
      scale_input = parse_file(file, initial_index=initial_index)
  else:
    scale_input = parse_file(sys.stdin, initial_index=initial_index)
  muddle_groups = permute(scale_input)
  print_muddle_groups(muddle_groups, initial_index=initial_index, show_context=show_context, output_format=output_format)


if __name__ == '__main__':
  args = parse_args()
  main(args.filename, initial_index=args.initial_index, show_context=args.show_context, output_format=args.format)
