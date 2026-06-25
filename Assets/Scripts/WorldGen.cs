using UnityEngine;
using System.Collections.Generic;

// A compact Streets-of-Rogue-style floor, generated fresh every call:
// dark ground, an unbreakable boundary, a grid of walled rooms (tiered breakable
// walls with a gate gap per room), a reinforced vault in the centre, and scattered enemies.
// Returns the player spawn point. Ports the v2 compound/tier ideas to Unity GameObjects + Physics2D.
public static class WorldGen
{
    const float HW = 34f, HH = 22f;   // world half-extents

    // room types: floor tint + centre-marker colour + wall hardness tier (ports the v2 ROOM_KINDS idea)
    struct RoomKind { public string name; public Color tint; public Color col; public int tier; }
    static readonly RoomKind[] KINDS =
    {
        new RoomKind { name = "Home",   tint = new Color(0.17f, 0.15f, 0.21f), col = new Color(0.55f, 0.42f, 0.30f), tier = 0 },
        new RoomKind { name = "Shop",   tint = new Color(0.21f, 0.18f, 0.13f), col = new Color(0.88f, 0.72f, 0.32f), tier = 0 },
        new RoomKind { name = "Smithy", tint = new Color(0.18f, 0.17f, 0.17f), col = new Color(0.62f, 0.64f, 0.70f), tier = 1 },
        new RoomKind { name = "Garden", tint = new Color(0.14f, 0.18f, 0.14f), col = new Color(0.45f, 0.72f, 0.40f), tier = 0 },
        new RoomKind { name = "Vault",  tint = new Color(0.22f, 0.14f, 0.14f), col = new Color(0.92f, 0.80f, 0.34f), tier = 2 },
    };

    // --- layout snapshot for the HUD minimap, published on every Generate ---
    public static int Gen;                                          // bumps each floor build (incl. R-reroll) so the HUD can reset its fog
    public static Vector2[] RoomCenters;                            // row-major centres of the rows*cols room cells
    public static int BossCell = -1;                               // index into RoomCenters of the gatekeeper's chamber
    public static Vector2 RoomSize;                                // room footprint, for drawing the cells
    public static readonly Vector2 WorldHalf = new Vector2(HW, HH);   // world half-extents, for normalising positions

    public static Vector2 Generate(Transform root, Transform player, System.Action onDescend, int floorNum)
    {
        var realm = Realms.For(floorNum);
        Floor(root, Vector2.zero, new Vector2(HW * 2f + 4f, HH * 2f + 4f), realm.ground, -5);
        Boundary(root);

        int cols = 3, rows = 2;
        float roomW = 16f, roomH = 13f, gapX = 7f, gapY = 7f;
        float totalW = cols * roomW + (cols - 1) * gapX;
        float totalH = rows * roomH + (rows - 1) * gapY;
        float x0 = -totalW / 2f + roomW / 2f, y0 = -totalH / 2f + roomH / 2f;
        float ax1 = x0 + roomW / 2f + gapX / 2f;   // vertical alley lane between columns 0 and 1
        float ax2 = ax1 + (roomW + gapX);          // between columns 1 and 2

        // a street grid threading the alleys (above the base floor, in the gaps so it never paves a room)
        Color road = realm.road;
        float rw = 3.2f;
        Floor(root, new Vector2(0f, 0f), new Vector2(HW * 2f - 3f, rw), road, -3);    // horizontal spine through the central alley
        Floor(root, new Vector2(ax1, 0f), new Vector2(rw, HH * 2f - 4f), road, -3);   // vertical lane 1
        Floor(root, new Vector2(ax2, 0f), new Vector2(rw, HH * 2f - 4f), road, -3);   // vertical lane 2

        int bossR = Random.Range(0, rows), bossC = Random.Range(0, cols);   // one room hides the gatekeeper + portal
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
            {
                float rx = x0 + c * (roomW + gapX);
                float ry = y0 + r * (roomH + gapY);
                if (r == bossR && c == bossC)
                {
                    BossChamber(root, player, rx, ry, roomW - 1f, roomH - 1f, onDescend, floorNum);
                    continue;
                }
                var k = KINDS[Random.Range(0, KINDS.Length)];
                Floor(root, new Vector2(rx, ry), new Vector2(roomW, roomH), k.tint, -4);
                Room(root, rx, ry, roomW - 1f, roomH - 1f, k.tier);
                var prop = SpriteFactory.Quad(k.name, new Vector2(rx, ry), new Vector2(1.3f, 1.3f), k.col, 0);
                prop.transform.SetParent(root);

                // destructible crates/barrels scattered in the room interior (kept well off the walls + gate)
                int props = Random.Range(0, 4);
                for (int pi = 0; pi < props; pi++)
                {
                    Vector2 ppos = new Vector2(rx + Random.Range(-roomW * 0.28f, roomW * 0.28f),
                                               ry + Random.Range(-roomH * 0.28f, roomH * 0.28f));
                    Prop.Spawn(root, ppos, Random.value < 0.35f);   // ~35% barrels
                }
            }

        // a reinforced vault in the centre alley
        Floor(root, Vector2.zero, new Vector2(7f, 6f), new Color(0.22f, 0.14f, 0.14f), -4);
        Room(root, 0f, 0f, 6.5f, 5.5f, 2);

        // enemies in the OPEN alleys only (reachable; never sealed inside a room or clipped into a wall).
        // Both the count and the share of tough archetypes scale with depth.
        float ay = totalH * 0.34f;
        Vector2 entrance = new Vector2(-HW + 5f, 0f);
        var cand = new List<Vector2>();
        for (float x = -22f; x <= 26f; x += 6.5f) cand.Add(new Vector2(x, 0f));            // central horizontal alley
        for (float y = -ay; y <= ay + 0.1f; y += 5f) { cand.Add(new Vector2(ax1, y)); cand.Add(new Vector2(ax2, y)); }   // vertical lanes
        cand.RemoveAll(c => Vector2.Distance(c, entrance) < 9f || (Mathf.Abs(c.x) < 4f && Mathf.Abs(c.y) < 3.5f));        // not on the entrance, not in the vault
        for (int i = cand.Count - 1; i > 0; i--) { int j = Random.Range(0, i + 1); var t = cand[i]; cand[i] = cand[j]; cand[j] = t; }   // shuffle
        int count = Mathf.Min(Mathf.Clamp(6 + floorNum, 6, 18), cand.Count);
        int eliteCap = Mathf.Clamp(floorNum / 3, 0, 4);   // 0 on floors 1-2, ramps to 4; caps a hot-RNG all-elite floor
        int elites = 0;
        for (int i = 0; i < count; i++)
        {
            var en = SpawnEnemy(root, player, cand[i], realm.enemy, floorNum, RollKind(floorNum));
            if (elites < eliteCap && RollElite(floorNum)) { en.MakeElite(floorNum); elites++; }
        }

        // scorched-ground hazards thicken with depth (player-only DoT; alleys stay walkable around them)
        int hazards = floorNum >= 4 ? Mathf.Min(1 + (floorNum - 4) / 2, 4) : 0;
        for (int i = 0; i < hazards; i++)
        {
            float hx, hy;
            if (Random.value < 0.5f) { hx = Random.value < 0.5f ? ax1 : ax2; hy = Random.Range(-ay, ay); }   // a vertical lane
            else { hx = Random.Range(-16f, 24f); hy = 0f; }                                                  // the central spine
            if (Mathf.Abs(hx) < 4.5f && Mathf.Abs(hy) < 4.5f) hx += 9f;                                      // keep off the central vault
            Hazard(root, new Vector2(hx, hy), Random.Range(2.6f, 3.6f));
        }

        // publish a layout snapshot for the HUD minimap (recomputed from the same grid params)
        var centers = new Vector2[rows * cols];
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++)
                centers[r * cols + c] = new Vector2(x0 + c * (roomW + gapX), y0 + r * (roomH + gapY));
        RoomCenters = centers;
        BossCell = bossR * cols + bossC;
        RoomSize = new Vector2(roomW, roomH);
        Gen++;

        return new Vector2(-HW + 5f, 0f);   // west-edge entrance
    }

    static void Floor(Transform root, Vector2 pos, Vector2 size, Color col, int order)
    {
        var go = SpriteFactory.Quad("Floor", pos, size, col, order);
        go.transform.SetParent(root);
    }

    static void Boundary(Transform root)
    {
        float t = 1.2f;
        Seg(root, new Vector2(0f, HH + t / 2f), new Vector2(HW * 2f + t * 2f, t), -1);   // top
        Seg(root, new Vector2(0f, -HH - t / 2f), new Vector2(HW * 2f + t * 2f, t), -1);  // bottom
        Seg(root, new Vector2(-HW - t / 2f, 0f), new Vector2(t, HH * 2f), -1);           // left
        Seg(root, new Vector2(HW + t / 2f, 0f), new Vector2(t, HH * 2f), -1);            // right
    }

    static void Room(Transform root, float cx, float cy, float w, float h, int tier)
    {
        float L = cx - w / 2f, R = cx + w / 2f, T = cy + h / 2f, B = cy - h / 2f;
        int gate = Random.Range(0, 4);   // 0 bottom, 1 top, 2 left, 3 right
        SegRow(root, L, R, B, true, tier, gate == 0);
        SegRow(root, L, R, T, true, tier, gate == 1);
        SegRow(root, B, T, L, false, tier, gate == 2);
        SegRow(root, B, T, R, false, tier, gate == 3);
    }

    // a row of wall segments from a..z along one axis (fixed perpendicular coord), gate gap in the middle if requested
    static void SegRow(Transform root, float a, float z, float fixedCoord, bool horizontal, int tier, bool gap)
    {
        float len = z - a, thick = 0.5f, segLen = 1.3f;
        int n = Mathf.Max(1, Mathf.RoundToInt(len / segLen));
        float step = len / n;
        float mid = (a + z) / 2f;
        for (int i = 0; i < n; i++)
        {
            float p = a + step * (i + 0.5f);
            if (gap && Mathf.Abs(p - mid) < step * 1.2f) continue;        // leave the gate open
            Vector2 pos = horizontal ? new Vector2(p, fixedCoord) : new Vector2(fixedCoord, p);
            Vector2 size = horizontal ? new Vector2(step, thick) : new Vector2(thick, step);
            Seg(root, pos, size, tier);
        }
    }

    static void Seg(Transform root, Vector2 pos, Vector2 size, int tier)
    {
        var go = SpriteFactory.Quad("Wall", pos, size, Color.white, 1);
        go.transform.SetParent(root);
        go.AddComponent<BoxCollider2D>();
        go.AddComponent<Wall>().Init(tier);
    }

    // a sealed reinforced chamber holding the dormant portal + the gatekeeper boss (the floor's objective)
    static void BossChamber(Transform root, Transform player, float cx, float cy, float w, float h, System.Action onDescend, int floorNum)
    {
        Floor(root, new Vector2(cx, cy), new Vector2(w + 1f, h + 1f), new Color(0.22f, 0.13f, 0.14f), -4);
        Room(root, cx, cy, w, h, 2);   // reinforced walls, one gate

        var portalGo = SpriteFactory.Quad("Portal", new Vector2(cx, cy + 1.5f), new Vector2(1.6f, 1.6f), new Color(0.18f, 0.18f, 0.26f), 5);
        portalGo.transform.SetParent(root);
        var portal = portalGo.AddComponent<Portal>();
        portal.onEnter = onDescend;

        var bossGo = SpriteFactory.Quad("Boss", new Vector2(cx, cy - 2f), new Vector2(1.5f, 1.5f), new Color(0.95f, 0.55f, 0.2f), 9);
        bossGo.transform.SetParent(root);
        var brb = bossGo.AddComponent<Rigidbody2D>();
        brb.gravityScale = 0f;
        brb.freezeRotation = true;
        bossGo.AddComponent<BoxCollider2D>();
        bossGo.AddComponent<Boss>().Init(player, portal, floorNum);
    }

    static void Hazard(Transform root, Vector2 pos, float size)
    {
        var go = SpriteFactory.Quad("Hazard", pos, new Vector2(size, size), new Color(0.72f, 0.24f, 0.1f), -2);   // above road, below walls
        go.transform.SetParent(root);
        go.AddComponent<Hazard>();
    }

    // archetype roll: deeper floors lean harder on ranged kiters and brutes (0 chaser, 1 ranged, 2 brute)
    static int RollKind(int floorNum)
    {
        float brute = Mathf.Min(0.05f + 0.02f * floorNum, 0.25f);
        float ranged = Mathf.Min(0.24f + 0.02f * floorNum, 0.45f);
        float r = Random.value;
        if (r < brute) return 2;
        if (r < brute + ranged) return 1;
        return 0;
    }

    // elite chance climbs with depth (the per-floor cap in Generate bounds how many actually upgrade)
    static bool RollElite(int floorNum)
    {
        return Random.value < Mathf.Min(0.08f + 0.03f * floorNum, 0.35f);
    }

    static Enemy SpawnEnemy(Transform root, Transform player, Vector2 pos, Color col, int floorNum, int kind)
    {
        var go = SpriteFactory.Quad("Enemy", pos, new Vector2(0.85f, 0.85f), col, 8);
        go.transform.SetParent(root);
        var rb = go.AddComponent<Rigidbody2D>();
        rb.gravityScale = 0f;
        rb.freezeRotation = true;
        go.AddComponent<BoxCollider2D>();
        var en = go.AddComponent<Enemy>();
        en.Init(player, floorNum, kind);
        return en;
    }
}
