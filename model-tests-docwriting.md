## 'deepseek-coder-v2:16b-lite-instruct-q5_1' and q4_k_m
 both fail miserably on the large context task (~16k)

## 'phi3:14b-medium-128k-instruct-q6_K'
  does *pretty* well, seems like the larger quants are better at keeping track of wtf is going on
  actually on second thought that might be placebo, done a few runs now and it seems inconclusive
 
## hermes 2 theta l3 8B  
  actually seems to be the best of all the models tested so far? really wanna see how 70b does

## command r 35B q4_k_m
  seems about on par with hermes 2 8B, disappointing since it's a much bigger model, not sure why it's underperfoming relative ot expectations
  
## command-r+ 104B q2_k_xxs 
  terrible, braindamaged, slow

## llama3-70b-chatqa1.5
  i think this only has 8k context like regular llama so part of the prompt is getting truncated (??) but the actual perf is the seems pretty good, not like, stellar, but on par at least with the other models, one of the only ones that ever got the ps endpoint correctly
  one run went off the rails tho so... idfk
