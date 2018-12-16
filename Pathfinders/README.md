# Algorithm Documentation
## A* Pathfinding
Standard A* algorithim as per Peter E. Hart, Nils J. Nilsson, Bertram Raphael, 1968.
Should you want to learn how the algorithm works: https://en.wikipedia.org/wiki/A*_search_algorithm

### ASTARReturnState
Object with the following properties:
* `ENUMStatus` - Provides the respective `bot.pathfinder.ENUMStatus` based on the outcome of the path search.
* `path` - Array of points which form the entirety of the path.

#### ASTARReturnState.on( Callback)
Provides a function to be executed when the path search has completed

* `Callback` - Function to be executed once the path search has completed, `ASTARReturnState` passed as argument.


## D* Lite Pathfinding
D* Lite as per S. Koenig, 2002.
Before using the algorithm it is important to familiarize yourself with its function at: http://idm-lab.org/bib/abstracts/papers/aaai02b.pdf.

The pathfinder module exposes two different D* Lite implementations. One which is standard D* Lite implementation as presented in Figure 3 of the paper, and the other which is an optimized variant, presented in Figure 4.
I have left the unoptimized variant in the code should anyone wish to familiarize themselves with how it works.

The advantage of using D* Lite is it precomputes the global state between the start and end point, this allows for convenient changes of costs at runtime, which can be used for entity avoidance.

However it requires the use of the `getPredecessors` function. When supplying your own `getSuccessors` and `getPredecessors` functions, ensure that both functions always return the exact same set of neighbours respectively, especially when using the optimized variant of D* Lite. The unoptimized version has some more leeway in handling any inconsistencies between `getSuccessors` and `getPredecessors`.

### DLITEReturnState
Object with the following properties:
* `ENUMStatus` - Provides the respective `bot.pathfinder.ENUMStatus` based on the outcome of the path search.
* `path` - See `DLITEReturnState.path`

#### ASTARReturnState.on( Callback)
Provides a function to be executed when the path search has completed

* `Callback` - Function to be executed once the path search has completed, `DLITEReturnState` passed as argument.

#### ASTARReturnState.path.pop()
As the path is determined while the bot moves across it, pop must be used to determine the next location to move to.

Returns position vector.

#### ASTARReturnState.path.peek()
Determines which path element will be popped next.

Returns position vector.

#### ASTARReturnState.path.replan([startPoint, endPoint]) /[Not implemented]


## JPS A* Pathfinding \[Not implemented]
Jump Point Search as per Daniel Harabor, Alban Grastien, 2011.
Should you want to learn how the algorithm works: http://users.cecs.anu.edu.au/~dharabor/data/papers/harabor-grastien-aaai11.pdf.

I am including this here as there was some conversation about using JPS in the past (PrismarineJS/mineflayer-navigate#20). It should be noted that JPS is a method to replace the `getSuccessors` function, and then chooses which neighbour to go to using A*.

It is also important to note that most of the movement in minecraft is done on the horizontal plane, so in effect 2D. This can be used to generalize the algorithim to a 2D version with additional checks whether the bot can change its y-level at a point.

The significant speed improvement of JPS comes from quickly checking which blocks it can move to, however it is based on the assumption that you can check what kind of block exists at a coordinate very quickly. To achieve this i wrote `bot.pathfinder.getBlock`, however I was not able to get JPS running faster than normal A*, hence why it is not included.

Should anyone be inclined to attempt to implement JPS, you can do so by replacing `bot.pathfinder.getSuccessors` with your JPS function for obtaining neighbours.