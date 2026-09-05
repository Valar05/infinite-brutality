import argparse,json,time,urllib.request,shutil
from pathlib import Path

def post(url,data):
 req=urllib.request.Request(url,data=json.dumps(data).encode(),headers={'Content-Type':'application/json'});return json.load(urllib.request.urlopen(req,timeout=30))
def get(url):return json.load(urllib.request.urlopen(url,timeout=30))
def workflow(checkpoint,lora,prompt,seed,prefix):
 return {'1':{'class_type':'CheckpointLoaderSimple','inputs':{'ckpt_name':checkpoint}},'2':{'class_type':'LoraLoader','inputs':{'model':['1',0],'clip':['1',1],'lora_name':lora,'strength_model':1.0,'strength_clip':1.0}},'3':{'class_type':'CLIPTextEncode','inputs':{'clip':['2',1],'text':prompt}},'4':{'class_type':'CLIPTextEncode','inputs':{'clip':['2',1],'text':'shading, gray wash, color, painterly, photorealistic, flesh blob, background clutter, hatching, gradient'}},'5':{'class_type':'EmptyLatentImage','inputs':{'width':512,'height':512,'batch_size':1}},'6':{'class_type':'KSampler','inputs':{'model':['2',0],'positive':['3',0],'negative':['4',0],'latent_image':['5',0],'seed':seed,'steps':28,'cfg':7.0,'sampler_name':'dpmpp_2m','scheduler':'karras','denoise':1.0}},'7':{'class_type':'VAEDecode','inputs':{'samples':['6',0],'vae':['1',2]}},'8':{'class_type':'SaveImage','inputs':{'images':['7',0],'filename_prefix':prefix}}}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--api',default='http://127.0.0.1:8188');ap.add_argument('--checkpoint',required=True);ap.add_argument('--lora',required=True);ap.add_argument('--prompts',required=True);ap.add_argument('--comfy-output',required=True);ap.add_argument('--out',required=True);args=ap.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
 prompts=json.loads(Path(args.prompts).read_text());receipts=[]
 for item in prompts:
  graph=workflow(args.checkpoint,args.lora,item['prompt'],int(item['seed']),item['id']);queued=post(args.api+'/prompt',{'prompt':graph});pid=queued['prompt_id'];deadline=time.time()+900
  while time.time()<deadline:
   history=get(args.api+'/history/'+pid)
   if pid in history:
    images=history[pid].get('outputs',{}).get('8',{}).get('images',[])
    if not images:raise RuntimeError('completed prompt has no SaveImage output')
    src=Path(args.comfy_output)/images[0].get('subfolder','')/images[0]['filename'];dest=out/(item['id']+'.png');shutil.copy2(src,dest);receipts.append({'id':item['id'],'prompt_id':pid,'file':str(dest),'bytes':dest.stat().st_size});break
   time.sleep(2)
  else:raise TimeoutError(pid)
 print(json.dumps({'schema':'FLESHPUNK COMFY CANARY RUN 1','images':receipts,'visualAcceptance':False},separators=(',',':')))
if __name__=='__main__':main()
