# ollama model notes 
(looks like ram residency is about 1gb + model size on disk, which is different (more efficient) than exl2 w/ ooba)
models marked with a :computer: are ones i've tested

the rules thumb for picking quant size are 
- Q4_K_M is BiS if you can fit it, if you can't use the largest IQX_X_X you can fit 
- get the largest number of weights you can fit until you go down to IQ2_X_X, 70B < 2bpw ≈ 35B fp16
- larger quants appear to be essentially placebo (more accurate but marginally, and slower)

sources:
1. [quant comparison rentry](https://rentry.org/llama-cpp-quants-or-fine-ill-do-it-myself-then-pt-2)
2. [llama 3 quant comparison blog post](https://huggingface.co/blog/wolfram/llm-comparison-test-llama-3)
3. [llama3 quant comparison chart](https://github.com/matt-c1/llama-3-quant-comparison?tab=readme-ov-file#correctness-vs-model-size)
4. [quant comparison gist](https://gist.github.com/Artefact2/b5f810600771265fc1e39442288e8ec9 )
5. [reddit post about GGUF quantization methods](https://www.reddit.com/r/LocalLLaMA/comments/1ba55rj/overview_of_gguf_quantization_methods/)
6. [llama.cpp issue comparing IQ3_S and Q3_K](https://github.com/ggerganov/llama.cpp/pull/5676)
7. [older llama.cpp  quant strats](https://github.com/ggerganov/llama.cpp/pull/1684)

## fit in 43gb (gv100 + 1080Ti)
- :computer: `llama3-chatqa:70b-v1.5-q3_K_M`(ends up being 3.88bpw?)
  - nvidia finetuned llama3 supposedly better at RAG type beats
  - ~~curious about this particular quant/size just because it requires splitting across GPUs and I wanna know if it works in ollama~~
  - this does in fact work in ollama (bf 1.08, gv100+1080ti = 8.5tps)
- `command-r-plus:104b-q2_K`
  - 128k context
  - huge model, probably can't run this (39gb blob)
  - 2bit so may be braindamaged, but lots of parameters may make up for that?
- :computer:`vanilj/midnight-miqu-70b-v1.5:latest`
  - ~~also probably too big~~, but 4chan says this is a BiS model, Qwen2 based finetune merge iirc
  - 39.5gb on disk 41 in mem (bf 1.04, gv100+1080ti = 7.3tps)
- [meta-llama-3-70b-instruct-imat-IQ3_XS.gguf](https://huggingface.co/qwp4w3hyb/Meta-Llama-3-70B-Instruct-iMat-GGUF/tree/main)
  - 29.3gb on disk, 30gb in vram, 10tps
  - seems kinda slow given that it's only using the one GPU and that one GPU should be about 2x as fast as the slower one, interesting scaling

## fit in 32gb
- `llava:34b-v1.6-q4_1`
  - very curious about multimodal models
  - based on llama 1? (not that llama 1 was even bad, and i can't find any multimodal models based on more recent training)
    - looks like there's a new one [Cambrian-1](https://github.com/cambrian-mllm/cambrian?tab=readme-ov-file#cambrian-weights) and as noted on their github page there are a few new llava versions finetuned from llama3-8b, vicuna1.5-13b and Hermes2-Yi-34B the weights for which can be found  
  - would have to add multimodal support to SHODAN
    - image paste handler, client side scaling (llava requires particular image dims iirc)
- `dolphin-mixtral:8x7b-v2.7-q4_1`
  - 32k context
  - `dolphin-mixtral:8x7b-v2.7-q4_0` (same as `dolphin-mixtral:latest`, use if above doesn't fit in one gpu)
  - apparently a finetune of mixtral to be uncensored, not sure of it's utility
- `mixtral:8x7b-text-v0.1-q4_1`
  - 32k context
  - `mixtral:8x7b-text-v0.1-q4_0` if above doesn't fit
  - MoE models are supposedly fast X smart, but PHI and hermes are said to beat mixtral
- :computer: `command-r:35b-v0.1-q4_K_M`
  - supposedly very good at RAG

## fit in 16gb
- :computer:`deepseek-coder-v2:16b-lite-instruct-q5_1` (12.6gb resident, 38tps)
  - MoE model, should have very fast inference, very recently trained
- `deepseek-v2:16b-lite-chat-q5_1`
  - chat version of above
  - also has `q8_0` and `q6_k` sizes avaliable, the latter *may fit in 16gb* might be worth looking at especially for the coding version?
- `codestral:22b-v0.1-q4_1`
  - specifically good at code gen
  - above quant may be too big for 16gb `codestral:22b-v0.1-q4_0` should fit for sure
- `yi:34b-chat-v1.5-q5_1` and `yi:34b-v1.5-q5_1`
  - i'm wary of chinese models but yi scores highly on leaderboards

## fit in 11gb (1080Ti)
- :computer: `phi3:14b-medium-128k-instruct-q4_1`
  - 10gb in mem (bf 1.15x, v100 = 35tps)
  - performs very well on leaderboards
  - huge context window could be very nice for RAG
  - **TODO** the 4k context model appears to outperform the larger model on leaderboards, investigate?
  - also available as a 6_K quant (`phi3:14b-medium-128k-instruct-q6_K`) which should fit into 16gb

## fit in 8gb
- `llama3-gradient`
  - extends the llama3 context window to 1m tokens from 8k
- :computer: `interstellarninja/hermes-2-theta-llama-3-8b:latest` (q4_0)
  - 5.9gb in mem (bf 1.2x, v100 = 46.5 tps)
  - subjectively the best 8B model i've tried, has interesting funcalling training
- :computer: [Llama-3-Instruct-8B-SPPO-Iter3-Q4_K_M.gguf](https://huggingface.co/bartowski/Llama-3-Instruct-8B-SPPO-Iter3-GGUF/tree/main)
  - 53tps 
  - interesting self-tuning training method, performs very highly on benchmarks but i suspect it's overtuned
- `phi3:3.8b-mini-4k-instruct-q6_K`
- `phi3:3.8b-mini-4k-instruct-q8_0`
- `phi3:14b-medium-128k-instruct-q2_K`
  - 2bit quants are usually braindamaged, but might be interesting to try
- `yi:9b-chat-v1.5-q5_1` and `yi:9b-v1.5-q5_1`
  - same qualms as bigger model, chinese model but scores well
## fit in 4gb
- :computer:`phi3:3.8b` (q4_k_m, 3.7gb resident, 85tps)
- :computer:`phi3:3.8b-mini-4k-instruct-q4_1` exactly the same as above on my machine
