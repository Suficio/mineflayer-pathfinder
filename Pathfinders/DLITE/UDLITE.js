'use strict';
const Path = require('path');
const DLITEReturnState = require(Path.resolve(__dirname, 'DLITEReturnState.js'));

module.exports = function(bot, sp, ep)
{
    // D* Lite as per S. Koenig, 2002
    // Compute Shortest Path and UpdateVertex as described in http://idm-lab.org/bib/abstracts/papers/aaai02b.pdf
    // Based on D* Lite as presented in Figure 3.

    // The advantage of using D* Lite is it precomputes the global state between the start and end point, this
    // allows for convenient changes of costs at runtime, which can be used for entity avoidance.

    const ReturnState = new DLITEReturnState(bot, sp, ep);
    const R = ReturnState;

    function CalculateKey(s)
    {
        return [Math.min(s.g, s.rhs) + bot.pathfinder.HEURISTIC(R.S.start.p, s.p) + R.km, Math.min(s.g, s.rhs)];
    }

    Object.defineProperty(R, 'UpdateVertex', {value: UpdateVertex, enumerable: false});
    function UpdateVertex(u)
    {
        if (u !== R.S.goal)
        {
            u.rhs = Number.POSITIVE_INFINITY;

            const successors = bot.pathfinder.getSuccessors(u.p);
            for (let n = 0, len = successors.length; n < len; n++)
            {
                const sp = new R.State(successors[n]);
                const cost = bot.pathfinder.COST(u.p, sp.p) + sp.g;
                if (u.rhs > cost) u.rhs = cost;
            }
        }

        const exists = R.U.check(u);
        if (exists) R.U.remove(exists);
        if (!floatEqual(u.g, u.rhs)) R.U.insert(u, CalculateKey(u));
    }

    Object.defineProperty(R, 'ComputeShortestPath', {value: ComputeShortestPath, enumerable: false});
    function ComputeShortestPath()
    {
        const CSPPromise = new Promise(function(resolve)
        {
            const closest = R.S.goal;

            for (let i = 0; i < bot.pathfinder.MAX_EXPANSIONS && R.U.size !== 0 &&
                (CompareKeys(R.U.peek().k, CalculateKey(R.S.start)) || !floatEqual(R.S.start.rhs, R.S.start.g)); i++)
            {
                const u = R.U.pop();
                const k_old = u.k;
                const k_new = CalculateKey(u);

                if (CompareKeys(k_old, k_new))
                    R.U.insert(u, k_new);
                else if (u.g > u.rhs)
                {
                    u.g = u.rhs;

                    const predecessors = bot.pathfinder.getPredecessors(u.p);
                    for (let n = 0, len = predecessors.length; n < len; n++)
                    {
                        const s = new R.State(predecessors[n]);
                        R.UpdateVertex(s);
                    }
                }
                else
                {
                    u.g = Number.POSITIVE_INFINITY;

                    const predecessors = bot.pathfinder.getPredecessors(u.p);
                    predecessors.push(u.p); // ∪ {u}
                    for (let n = 0, len = predecessors.length; n < len; n++)
                    {
                        const s = new R.State(predecessors[n]);
                        R.UpdateVertex(s);
                    }
                }

                // Storest closest element
                // if (fastDistance(closest.p, R.S.start.p) > fastDistance(u.p, R.S.start.p)) closest = u;
            }
            if (R.S.start.g === Number.POSITIVE_INFINITY)
                resolve({ENUMStatus: bot.pathfinder.ENUMStatus.Incomplete, State: closest});
            else
                resolve({ENUMStatus: bot.pathfinder.ENUMStatus.Complete});
        });

        return CSPPromise;
    }

    R.Initialize();

    return ReturnState;
};

function CompareKeys(k1, k2)
{
    return (floatEqual(k1[0], k2[0]) && k1[1] < k2[1]) || k1[0] < k2[0];
}

function floatEqual(f1, f2)
{
    if (f1 === Number.POSITIVE_INFINITY && f2 === Number.POSITIVE_INFINITY) return true;
    return Math.abs(f1 - f2) < Number.EPSILON;
}

/* function fastDistance(p1, p2)
{
    // Just avoids using square root as we know that if p1^2 > p2^2 => p1 > p2
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;

    return dx * dx + dy * dy + dz * dz;
}*/
