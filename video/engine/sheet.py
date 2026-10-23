# Contact sheets of stills/t*.png -> stills/sheet_<prefix>_<n>.png (run by video/render.py).
import sys,glob
from PIL import Image
fs=sorted(glob.glob('stills/t*.png')); pre=sys.argv[1]
for k in range(0,len(fs),4):
    S=Image.new('RGB',(2560,1440))
    for i,f in enumerate(fs[k:k+4]): S.paste(Image.open(f),((i%2)*1280,(i//2)*720))
    S.resize((1800,1012)).save(f'stills/sheet_{pre}_{k//4}.png')
print(len(fs))
