# notes on doc writing
using the llm to write documentation for code

the high level overview is that none of the models seem to be obviously super good at this test, some are better than others but none of my testing was particularly rigorous, it would be good to write a test rig and dive into this in a more structured way but

the one definite conclusion we can take away is that **Hermes 2 Theta 8B is fine**. 

While I will probably keep tweaking/working on this stuff some more, but it seems *likely* that if we stopped caring about which model we ran and just stuck to H2T-8B-Q4_0 we wouldn't be missing out huge gains

## methodology

i used the prompt 
```md
here is the documentation for the ollama api
[ollama documentation in markdown]

here is a wrapper i wrote for the documentation, ollama.mjs
\`\`\`js
//ollama.mjs
\`\`\`

please write a readme file for my wrapper library, 
include a quick start guide and a high level overview
```

then i ran this prompt a *few* times (2-3) and evaluated the vibes of the output subjectively 
after a few runs i ended up looking for it's description of the `tags` and `ps` endpoints especially because it's not clear at all from the code what they do but it is explained in the documentation, i didn't write it all down and i will probably re-run the tests, but generally the ones i had good things to say about got one or both of them correct in at least *some* runs

## model notes

### 'deepseek-coder-v2:16b-lite-instruct-q5_1' and q4_k_m
 both fail miserably on the large context task (~16k)

### 'phi3:14b-medium-128k-instruct-q6_K'
  does *pretty* well, seems like the larger quants are better at keeping track of wtf is going on
  actually on second thought that might be placebo, done a few runs now and it seems inconclusive
 
### hermes 2 theta l3 8B  
  actually seems to be one of the best of all the models tested so far? really wanna see how 70b does

### command r 35B q4_k_m
  seems about on par with hermes 2 8B, disappointing since it's a much bigger model, not sure why it's underperfoming relative ot expectations
  
### command-r+ 104B q2_k_xxs 
  terrible, braindamaged, slow

### llama3-70b-chatqa1.5
  i think this only has 8k context like regular llama so part of the prompt is getting truncated (??) but the actual perf is the seems pretty good, not like, stellar, but on par at least with the other models, one of the only ones that ever got the ps endpoint correctly
  one run went off the rails tho so... idfk

## dolphin-mixtral q4_K_M
  correctly described the tags and ps endpoints, didn't report `delete` to be `delete_m` , generally impressive perf
  
