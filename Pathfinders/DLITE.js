const Heap = require('fastpriorityqueue');

module.exports = function(bot, sp, ep)
{
    // D* Lite as per S. Koenig, 2002
    // Roughly as described in http://idm-lab.org/bib/abstracts/papers/aaai02b.pdf

    // The advantage of using D* Lite is it precomputes the global state between the start and end point, this allows for convenient changes of costs
    // at runtime, which can be used for entity avoidance.

    function DLITEReturnState()
    {
        // Global state functions
        const S = [];
        S.push = function(s)
        {
            const x = s.p.x >>> 0;
            const y = s.p.y >>> 0;

            if (!this[x])
                this[x] = [];
            if (!this[x][y])
                this[x][y] = [];

            this[x][y][s.p.z >>> 0] = s;
        };
        S.check = function(p)
        {
            const x = p.x >>> 0;
            if (this[x])
            {
                const y = p.y >>> 0;
                if (this[x][y])
                {
                    if (this[x][y][p.z >>> 0])

                        return true;
                }
            } return false;
        };

        this.State = function(p)
        {
            if (S.check(p))
                return S[p.x >>> 0][p.y >>> 0][p.z >>> 0];
            else
            {
                this.p = p;
                this.g = Number.POSITIVE_INFINITY;
                this.rhs = Number.POSITIVE_INFINITY;

                this.k;

                S.push(this);
            }
        };

        // Priority queue functions
        const U = new Heap(function(s1, s2) {return CompareKeys(s1.k, s2.k);});
        U.check = function(s)
        {
            for (let i = 0; i < this.size; i++)
                if (this.array[i] === s) return i;
            return undefined;
        };
        U.insert = function(s, k)
        {
            s.k = k;
            this.add(s);
        };
        U.update = function(i, k)
        {
            // Priority queue handles the perlocation automatically eitherway
            this.array[i].k = k;
        };

        // Maintain familiarity with original heap implementation
        U.remove = U._removeAt;
        U.pop = U.poll;

        // Attach for further use
        this.U = U;
        this.S = S;

        // Initialize
        this.km = 0;
        this.UpdateVertex = UpdateVertex;
        this.ComputeShortestPath = ComputeShortestPath;

        this.s_start = new this.State(sp);
        this.s_goal = new this.State(ep);
        this.s_goal.rhs = 0;

        this.s_last = this.s_start;

        U.insert(this.s_goal, [bot.navigate.HEURISTIC(this.s_start, this.s_goal), 0]);

        // ComputeShortestPath has to be run initially
        const ReturnState = this;
        this.on = function(Callback) {this.ComputeShortestPath().then(function() {Callback(ReturnState);});};
    };

    const R = new DLITEReturnState();

    function CalculateKey(s)
    {
        return [Math.min(s.g, s.rhs) + bot.navigate.HEURISTIC(R.s_start, s) + R.km, Math.min(s.g, s.rhs)];
    }

    function UpdateVertex(u)
    {
        const exists = this.U.check(u); // Integer index
        const equals = floatEqual(u.g, u.rhs);

        if (!equals && exists !== undefined) this.U.update(exists, CalculateKey(u));
        else if (!equals && exists === undefined) this.U.insert(u, CalculateKey(u));
        else if (equals && exists !== undefined) this.U.remove(exists);
    }

    function ComputeShortestPath()
    {
        const R = this;
        const CSPPromise = new Promise(function(resolve)
        {
            for (let i = 0; i < bot.navigate.MAX_EXPANSIONS && R.U.size !== 0 &&
                (CompareKeys(R.U.peek().k, CalculateKey(R.s_start)) || R.s_start.rhs > R.s_start.g); i++)
            {
                const u = R.U.peek();
                const k_old = u.k;
                const k_new = CalculateKey(u);

                if (CompareKeys(k_old, k_new))
                    R.U.update(u, k_new);
                else if (u.g > u.rhs)
                {
                    u.g = u.rhs;
                    R.U.pop(); // U.remove from first

                    const predecessors = bot.navigate.getPredecessors(u.p);
                    for (let n = 0, len = predecessors.length; n < len; n++)
                    {
                        const s = new R.State(predecessors[n]);
                        if (s !== R.s_goal) s.rhs = Math.min(s.rhs, bot.navigate.HEURISTIC(s, u) + u.g);
                        R.UpdateVertex(s);
                    }
                }
                else
                {
                    const g_old = u.g;
                    u.g = Number.POSITIVE_INFINITY;

                    const predecessors = bot.navigate.getPredecessors(u.p);
                    predecessors.push(u.p); // ∪ {u}
                    for (let n = 0, len = predecessors.length; n < len; n++)
                    {
                        const s = new R.State(predecessors[n]);
                        if (floatEqual(s, bot.navigate.HEURISTIC(s, u) + g_old))
                        {
                            if (s !== R.s_goal)
                            {
                                s.rhs = Number.POSITIVE_INFINITY;

                                const successors = bot.navigate.getSuccessors(u.p);
                                for (let m = 0, len = successors.length; m < len; m++)
                                {
                                    const sp = new R.State(successors[m]);
                                    const cost = bot.navigate.HEURISTIC(s, sp) + sp.g;
                                    if (s.rhs > cost) s.rhs = cost;
                                }
                            }
                        }
                        R.UpdateVertex(s);
                    }
                }
            }
            resolve();
        });

        return CSPPromise;
    }

    return R;
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
