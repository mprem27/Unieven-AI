"""Read a bounded raster photo from the authenticated AMS origin only."""
import base64
from urllib.parse import urljoin,urlsplit
MAX_PHOTO_BYTES=2_000_000

def image_mime(data):
    if data.startswith(b'\xff\xd8\xff'):return 'image/jpeg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):return 'image/png'
    if data.startswith((b'GIF87a',b'GIF89a')):return 'image/gif'
    if len(data)>=12 and data[:4]==b'RIFF' and data[8:12]==b'WEBP':return 'image/webp'
    return None

async def fetch_source_photo(client,url):
    try:
        absolute=urljoin('https://ams.veltech.edu.in/Default.aspx',str(url))
        parts=urlsplit(absolute)
        if parts.scheme!='https' or parts.hostname!='ams.veltech.edu.in' or parts.port not in (None,443) or parts.username or parts.password or '\\' in absolute:return None
        async with client.stream('GET',absolute,follow_redirects=False,timeout=10,headers={'Referer':'https://ams.veltech.edu.in/Default.aspx'}) as response:
            if response.status_code!=200:return None
            if int(response.headers.get('content-length','0'))>MAX_PHOTO_BYTES:return None
            data=bytearray()
            async for chunk in response.aiter_bytes():
                data.extend(chunk)
                if len(data)>MAX_PHOTO_BYTES:return None
            mime=image_mime(data)
            if not mime:return None
            return 'data:'+mime+';base64,'+base64.b64encode(data).decode('ascii')
    except Exception:return None
