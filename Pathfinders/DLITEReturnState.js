const Heap = require('fastpriorityqueue');

module.exports = function DLITEReturnState(bot, sp, ep, UpdateVertex, ComputeShortestPath)
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

    this.U = U;
    this.S = S;

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

    // Algorithm
    Initialize.call(this, bot, sp, ep, UpdateVertex, ComputeShortestPath);

    const R = this;
    this.path = {};
    this.path._peek = function()
    {
        // First part of Main() in D*Lite
        if (R.s_start === R.s_goal) return undefined;

        let minState;
        let minCost = Number.POSITIVE_INFINITY;

        const successors = bot.navigate.getSuccessors(R.s_start.p);
        for (let n = 0, len = successors.length; n < len; n++)
        {
            const sp = new R.State(successors[n]);
            const cost = bot.navigate.HEURISTIC(R.s_start, sp) + sp.g;
            if (minCost > cost)
            {
                minCost = cost;
                minState = sp;
            }
        }

        return minState;
    };
    this.path.peek = function()
    {
        const temp = this._peek();
        if (temp !== undefined)
            return temp.p;
        else return undefined;
    };
    this.path.pop = function()
    {
        const temp = this._peek();
        if (temp !== undefined)
        {
            R.s_start = temp;
            return temp.p;
        }
        else return undefined;
    };
};

function Initialize(bot, sp, ep, UpdateVertex, ComputeShortestPath)
{
    this.km = 0;
    this.UpdateVertex = UpdateVertex;
    this.ComputeShortestPath = ComputeShortestPath;

    this.s_start = new this.State(sp);
    this.s_goal = new this.State(ep);
    this.s_goal.rhs = 0;

    this.s_last = this.s_start;

    this.U.insert(this.s_goal, [bot.navigate.HEURISTIC(this.s_start, this.s_goal), 0]);

    const R = this; // ComputeShortestPath has to be run initially
    this.on = function(Callback)
    {
        this.ComputeShortestPath().then(function(ReturnState)
        {
            R.ENUMStatus = ReturnState.ENUMStatus;
            // Should the path be incomplete, sets the start point to the closest point to the intended
            // start point, to which a replan can be attempted using a different algorithm.
            if (ReturnState.ENUMStatus === bot.navigate.ENUMStatus.Incomplete)
            {
                console.log(
                    'WARNING: Did not find path in allowed MAX_EXPANSIONS, returned closest valid start point',
                    'Use another algorithm to reach the valid start point before attempting D*Lite'
                );
                R.s_start = ReturnState.State;
            }

            Callback(R);
        });
    };
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
