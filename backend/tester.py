from dotenv import load_dotenv
load_dotenv()

from r2_utils import presign_get_url
import os
url = presign_get_url(os.environ["R2_BUCKET_NAME"], "braveheart.txt", expires_seconds=300)
print(url)