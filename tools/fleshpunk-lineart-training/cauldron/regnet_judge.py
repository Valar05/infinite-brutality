import argparse, hashlib, json
from pathlib import Path
from PIL import Image
import torch
from torchvision.models import regnet_x_400mf, RegNet_X_400MF_Weights

def line_stats(path):
    image=Image.open(path).convert('RGB').resize((512,512))
    t=torch.frombuffer(bytearray(image.tobytes()),dtype=torch.uint8).reshape(512,512,3).float()/255
    delta=(t.max(2).values-t.min(2).values)
    luminance=t.mean(2)
    return {'white_ratio':float((luminance>.96).float().mean()),'dark_ratio':float((luminance<.25).float().mean()),'chroma_ratio':float((delta>.04).float().mean()),'mid_ratio':float(((luminance>=.25)&(luminance<=.96)).float().mean())}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--trace',required=True);ap.add_argument('--recreation',required=True);ap.add_argument('--mutation',required=True);ap.add_argument('--out',required=True);args=ap.parse_args()
    torch.manual_seed(0);weights=RegNet_X_400MF_Weights.IMAGENET1K_V2;model=regnet_x_400mf(weights=weights);model.fc=torch.nn.Identity();model.eval();prep=weights.transforms()
    paths=[args.trace,args.recreation,args.mutation]
    with torch.inference_mode(): emb=torch.stack([model(prep(Image.open(p).convert('RGB')).unsqueeze(0))[0] for p in paths]);emb=torch.nn.functional.normalize(emb,dim=1)
    scores={'traceSimilarity':float((emb[0]*emb[1]).sum()),'recreationSimilarity':float((emb[1]*emb[2]).sum()),'identityContinuity':float((emb[0]*emb[2]).sum())}
    stats={Path(p).stem:line_stats(p) for p in paths}; failures=[]
    for name,s in stats.items():
      if s['white_ratio']<.70:failures.append(f'{name}:white_background_below_0.70')
      if s['chroma_ratio']>.01:failures.append(f'{name}:color_present')
      if s['mid_ratio']>.22:failures.append(f'{name}:shading_or_gray_present')
      if s['dark_ratio']<.005:failures.append(f'{name}:no_readable_ink')
    if min(scores.values())<.82:failures.append('regnet_similarity_below_0.82')
    result={'schema':'REGNET QA JUDGMENT JAR 1','status':'PROCEED' if not failures else 'REJECT','model':'torchvision.regnet_x_400mf:IMAGENET1K_V2','scores':scores,'lineart':stats,'hardFailures':failures,'finalAcceptance':'USER_ONLY'}
    out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True);tmp=out.with_suffix(out.suffix+'.tmp');tmp.write_text(json.dumps(result,indent=2)+'\n');tmp.replace(out);print(json.dumps(result,separators=(',',':')))
if __name__=='__main__':main()
