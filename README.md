# e8k

Proof of concept of DNS exfiltration using pure DNS queries and A records as configuration responses

```python
a = "domain name system leak"
b = name.replace(" ", "")
c = len(b) - 2
d = f'{int(str(c)[0]) + int(a[0], 16):x}'
f'{d}{str(c)[1]}{a[-1]}'
```

## Usage

### Server

```bash
cd server
pnpm install
pnpm dev
```

### Client

```bash
cd client
./client.sh test-data/kitty.webp
```

## Benchmarks

```bash
# client:
./client.sh test-data/kitty.webp

# server:
# time taken: 9582ms, file size: 291844 bytes, speed (kb/s): 29.74
```

### Todo:

- [ ] golang client
- [ ] transfer multiple chunks in single query (3 x 63 chars)
- [ ] limit sessions to 255 (limit of single ip octet) or use multiple octets as workaround
- [x] filename in start session
- [x] speed measurement
