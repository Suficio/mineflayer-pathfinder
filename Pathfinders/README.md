# Algorithm Documentation

## Table of Contents
- [Algorithm Documentation](#algorithm-documentation)
    - [A* Pathfinding](#a-pathfinding)
        - [ASTARReturnState](#astarreturnstate)
            - [ASTARReturnState.on( Callback)](#astarreturnstateon-callback)
        - [ASTARReturnState.ENUMState](#astarreturnstateenumstate)
        - [ASTARReturnState.ClosestPoint](#astarreturnstateclosestpoint)
    - [D* Lite Pathfinding](#d-lite-pathfinding)
        - [DLITEReturnState](#dlitereturnstate)
            - [DLITEReturnState.on( Callback)](#dlitereturnstateon-callback)
        - [DLITEReturnState.ENUMState](#dlitereturnstateenumstate)
        - [DLITEReturnState.ClosestPoint](#dlitereturnstateclosestpoint)
            - [DLITEReturnState.path.pop()](#dlitereturnstatepathpop)
            - [DLITEReturnState.path.peek()](#dlitereturnstatepathpeek)
            - [DLITEReturnState.path.replan()](#dlitereturnstatepathreplan)
    - [JPS A* Pathfinding [Not implemented]](#jps-a-pathfinding-not-implemented)

## A* Pathfinding
Standard A* algorithim as per Peter E. Hart, Nils J. Nilsson, Bertram Raphael, 1968.
Should you want to learn how the algorithm works: https://en.wikipedia.org/wiki/A*_search_algorithm

### ASTARReturnState
Object with the following properties:

* `ENUMStatus` - Provides the respective `bot.pathfinder.ENUMStatus` based on the outcome of the path search.
* `path` - Array of points which form the entirety of the path.

### ASTARReturnState.ENUMState
Set when algorithim completes path search, equal to one of `bot.pathfinder.ENUMStatus` depending on whether the path search was successfull or not.

### ASTARReturnState.closestPoint
Set when algorithim the path search is incomplete, equal to the furthest position the bot could find a path to.

## D* Lite Pathfinding
D* Lite as per S. Koenig, Maxim Likhachev, 2002.
Before using the algorithm it is important to familiarize yourself with its function at: http://idm-lab.org/bib/abstracts/papers/aaai02b.pdf.

The pathfinder module exposes the D* Lite implementation, which is presented in Figure 4 of the paper.
The advantage of using D* Lite is it precomputes the global state between the start and end point, this allows for convenient changes of costs at runtime, which can be used for entity avoidance.

It is important to check if a path between the start and end is possible with D* Lite.

However it requires the use of the `getPredecessors` function. When supplying your own `getSuccessors` and `getPredecessors` functions, ensure that both functions always return the exact same set of neighbours respectively.

### DLITEReturnState [Not done]
Object with the following properties:

* `ENUMStatus` - Provides the respective `bot.pathfinder.ENUMStatus` based on the outcome of the path search.
* `path` - See `DLITEReturnState.path`

### DLITEReturnState.ENUMState
Set when algorithim completes path search, equal to one of `bot.pathfinder.ENUMStatus` depending on whether the path search was successful or not.

If `DLITEReturnState.ENUMState` is incomplete, it is recommended to use a different method to find the nearest valid point to navigate from.

#### DLITEReturnState.path.pop()
As the path is determined while the bot moves across it, pop must be used to determine the next location to move to.

Returns position vector.

#### DLITEReturnState.path.peek()
Determines which path element will be popped next.

Returns position vector.

#### DLITEReturnState.path.replan( position) [Doesn't work yet]
Recomputes the global state, returns promise which always evaluates to the same `DLITEReturnState`. Returned path will evaluate to a path from the provided position.


## JPS A* Pathfinding [Not implemented]
Jump Point Search as per Daniel Harabor, Alban Grastien, 2011.
Should you want to learn how the algorithm works: http://users.cecs.anu.edu.au/~dharabor/data/papers/harabor-grastien-aaai11.pdf.

I am including this here as there was some conversation about using JPS in the past (https://github.com/PrismarineJS/mineflayer-navigate/issues/20). It should be noted that JPS is a method to replace the `getSuccessors` function, and then chooses which neighbour to go to using A*.

It is also important to note that most of the movement in minecraft is done on the horizontal plane, so in effect 2D. This can be used to generalize the algorithim to a 2D version with additional checks whether the bot can change its y-level at a point.

The significant speed improvement of JPS comes from quickly checking which blocks it can move to, however it is based on the assumption that you can check what kind of block exists at a coordinate very quickly. To achieve this i wrote `bot.pathfinder.getBlock`, however I was not able to get JPS running faster than normal A*, hence why it is not included.

Should anyone be inclined to attempt to implement JPS, you can do so by replacing `bot.pathfinder.getSuccessors` with your JPS function for obtaining neighbours.
