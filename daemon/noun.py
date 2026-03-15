"""
noun.py — Minimal Urbit noun jam/cue implementation for sovnas-daemon.

In %sovnas, all IPC payloads are cord atoms (UTF-8 strings encoded as
little-endian integers). This implementation handles the full jam/cue spec.

Urbit nouns:
  - Atom: a natural number (0, 1, 2, ...)
  - Cell: an ordered pair [head tail] of nouns

jam(noun) -> int   : serialize a noun to an atom
cue(atom) -> noun  : deserialize an atom back to a noun
"""

import struct


# ---------------------------------------------------------------------------
# Atom <-> bytes helpers
# ---------------------------------------------------------------------------

def atom_to_bytes(n: int) -> bytes:
    """Convert a non-negative integer to little-endian bytes (no leading zeros)."""
    if n == 0:
        return b''
    length = (n.bit_length() + 7) // 8
    return n.to_bytes(length, 'little')


def bytes_to_atom(b: bytes) -> int:
    """Convert little-endian bytes to a non-negative integer."""
    if not b:
        return 0
    return int.from_bytes(b, 'little')


def cord_to_atom(s: str) -> int:
    """Encode a UTF-8 string as an Urbit cord (little-endian int)."""
    return bytes_to_atom(s.encode('utf-8'))


def atom_to_cord(n: int) -> str:
    """Decode an Urbit cord atom to a UTF-8 string."""
    return atom_to_bytes(n).decode('utf-8')


# ---------------------------------------------------------------------------
# Noun class
# ---------------------------------------------------------------------------

class Cell:
    """Represents an Urbit cell (pair of nouns)."""
    __slots__ = ('head', 'tail')

    def __init__(self, head, tail):
        self.head = head
        self.tail = tail

    def __repr__(self):
        return f'[{self.head!r} {self.tail!r}]'

    def __eq__(self, other):
        return isinstance(other, Cell) and self.head == other.head and self.tail == other.tail


# ---------------------------------------------------------------------------
# jam — serialize a noun to an atom
# ---------------------------------------------------------------------------

def jam(noun) -> int:
    """Serialize a noun to an atom using the Urbit jam algorithm."""
    cache: dict = {}   # value/id -> bit_position (for backrefs)
    bits: list = []    # list of (value, bit_length) tuples

    def emit(val: int, length: int) -> None:
        bits.append((val & ((1 << length) - 1), length))

    def mat(n: int) -> tuple:
        """Encode length prefix for atom n. Returns (bits_val, bit_count)."""
        if n == 0:
            return (1, 1)
        b = n.bit_length()
        bb = b.bit_length()
        # unary encoding: bb zeros then a 1
        unary_val = 1 << bb
        unary_len = bb + 1
        # lower (bb-1) bits of b (strip implicit MSB)
        b_low = b & ((1 << (bb - 1)) - 1)
        b_low_len = bb - 1
        # all b bits of n
        val = unary_val | (b_low << unary_len) | (n << (unary_len + b_low_len))
        return (val, unary_len + b_low_len + b)

    def _jam_inner(noun, pos: int) -> int:
        if isinstance(noun, int):
            ref_pos = cache.get(('a', noun))
            if ref_pos is not None:
                # compare atom encoding vs backreference encoding
                m_val, m_len = mat(noun)
                atom_len = 1 + m_len
                r_val, r_len = mat(ref_pos)
                ref_len = 2 + r_len
                if ref_len < atom_len:
                    emit(0b11, 2)
                    emit(r_val, r_len)
                    return pos + 2 + r_len
            # encode as atom: tag 0, mat(n), n bits
            emit(0, 1)
            m_val, m_len = mat(noun)
            emit(m_val, m_len)
            new_pos = pos + 1 + m_len
            cache.setdefault(('a', noun), pos)
            return new_pos
        else:
            # cell: tag 01, then head, then tail
            emit(0b01, 2)
            new_pos = pos + 2
            cache.setdefault(('c', id(noun)), pos)
            new_pos = _jam_inner(noun.head, new_pos)
            new_pos = _jam_inner(noun.tail, new_pos)
            return new_pos

    _jam_inner(noun, 0)

    # pack bits into an integer (LSB first)
    result = 0
    offset = 0
    for val, length in bits:
        result |= val << offset
        offset += length
    return result


# ---------------------------------------------------------------------------
# cue — deserialize an atom to a noun
# ---------------------------------------------------------------------------

def cue(atom: int):
    """Deserialize a jammed atom back to a noun."""
    cache: dict = {}  # bit_position -> noun

    def get_bit(pos: int) -> int:
        return (atom >> pos) & 1

    def rub(pos: int) -> tuple:
        """Decode length-prefixed atom at pos. Returns (value, bits_consumed)."""
        k = 0
        while get_bit(pos + k) == 0:
            k += 1
        if k == 0:
            return (0, 1)
        b_low = 0
        for i in range(k - 1):
            b_low |= get_bit(pos + k + 1 + i) << i
        b = (1 << (k - 1)) | b_low
        val = 0
        for i in range(b):
            val |= get_bit(pos + k + 1 + (k - 1) + i) << i
        return (val, k + 1 + (k - 1) + b)

    def _cue(pos: int) -> tuple:
        """Decode noun at bit position pos. Returns (noun, new_pos)."""
        tag0 = get_bit(pos)
        if tag0 == 0:
            val, consumed = rub(pos + 1)
            noun = val
            cache[pos] = noun
            return (noun, pos + 1 + consumed)
        tag1 = get_bit(pos + 1)
        if tag1 == 0:
            head, p1 = _cue(pos + 2)
            tail, p2 = _cue(p1)
            noun = Cell(head, tail)
            cache[pos] = noun
            return (noun, p2)
        else:
            ref_pos, consumed = rub(pos + 2)
            noun = cache[ref_pos]
            cache[pos] = noun
            return (noun, pos + 2 + consumed)

    noun, _ = _cue(0)
    return noun


# ---------------------------------------------------------------------------
# Wire format: length-prefixed noun over Unix domain socket
# ---------------------------------------------------------------------------

def encode_noun(noun) -> bytes:
    """
    Encode a noun for the %lick socket.
    Format: 4-byte little-endian byte-length, then jammed atom as LE bytes.
    """
    jammed = jam(noun)
    data = atom_to_bytes(jammed)
    return struct.pack('<I', len(data)) + data


def decode_noun(data: bytes):
    """Decode a noun from raw payload bytes (after the 4-byte length header)."""
    atom = bytes_to_atom(data)
    return cue(atom)
