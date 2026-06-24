using UnityEngine;

// A compact Streets-of-Rogue-style floor, generated fresh every call:
// dark ground, an unbreakable boundary, a grid of walled rooms (tiered breakable
// walls with a gate gap per room), a reinforced vault in the centre, and scattered enemies.
// Returns the player spawn point. Ports the v2 compound/tier ideas to Unity GameObjects + Physics2D.
public static class WorldGen
{
    const float HW = 34f, HH = 22f;   // world half-extents

    public static Vector2 Generate(Transform root, Transform player, System.Action onDescend, int floorNum)
    {
        Floor(root, Vector2.zero, new Vector2(HW * 2f + 4f, HH * 2f + 4f), new Color(0.13f, 0.12f, 0.16f), -5);
        Boundary(root);

        int cols = 3, rows = 2;
        float roomW = 16f, roomH = 13f, gapX = 7f, gapY = 7f;
        float totalW = cols * roomW + (cols - 1) * gapX;
        float totalH = rows * roomH + (rows - 1) * gapY;
        float x0 = -totalW / 2f + roomW / 2f, y0 = -totalH / 2f + roomH / 2f;

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
                int tier = Random.value < 0.55f ? 0 : 1;                 // mostly timber, some stone
                Floor(root, new Vector2(rx, ry), new Vector2(roomW, roomH), new Color(0.17f, 0.15f, 0.21f), -4);
                Room(root, rx, ry, roomW - 1f, roomH - 1f, tier);
            }

        // a reinforced vault in the centre alley
        Floor(root, Vector2.zero, new Vector2(7f, 6f), new Color(0.22f, 0.14f, 0.14f), -4);
        Room(root, 0f, 0f, 6.5f, 5.5f, 2);

        // enemies in the OPEN alleys only (reachable; never sealed inside a room or clipped into a wall)
        float ax1 = x0 + roomW / 2f + gapX / 2f;   // vertical gap lane between columns 0 and 1
        float ax2 = ax1 + (roomW + gapX);          // between columns 1 and 2
        float ay = totalH * 0.34f;
        Vector2[] spots =
        {
            new Vector2(-22f, 0f), new Vector2(-12f, 0f), new Vector2(12f, 0f), new Vector2(22f, 0f),
            new Vector2(ax1, -ay), new Vector2(ax1, ay), new Vector2(ax2, -ay), new Vector2(ax2, ay),
        };
        foreach (var s in spots) SpawnEnemy(root, player, s);

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

    static void SpawnEnemy(Transform root, Transform player, Vector2 pos)
    {
        var go = SpriteFactory.Quad("Enemy", pos, new Vector2(0.85f, 0.85f), new Color(0.85f, 0.3f, 0.3f), 8);
        go.transform.SetParent(root);
        var rb = go.AddComponent<Rigidbody2D>();
        rb.gravityScale = 0f;
        rb.freezeRotation = true;
        go.AddComponent<BoxCollider2D>();
        go.AddComponent<Enemy>().Init(player);
    }
}
