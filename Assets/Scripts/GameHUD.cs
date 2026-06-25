using UnityEngine;

// Minimal on-screen HUD via IMGUI (no UI prefab needed). Also surfaces the one
// project-setting fix if legacy input is disabled, so the slice is self-documenting.
public class GameHUD : MonoBehaviour
{
    public Player player;
    public Bootstrap boot;
    public int floor = 1;

    const float BannerDur = 2.6f;
    int lastFloor;          // 0 so the first floor (1) also triggers the intro banner
    float bannerT;

    int lastGen = -1;       // WorldGen.Gen of the floor whose minimap fog we're tracking
    bool[] visited;         // room cells the player has entered this floor
    bool bossFound;         // revealed the gatekeeper's chamber on the minimap
    float mmX, mmY, mmW, mmH;   // current minimap rect, set each draw

    void Update()
    {
        if (boot != null && boot.title) return;   // hold the floor banner until the run actually begins
        if (floor != lastFloor) { lastFloor = floor; bannerT = BannerDur; }   // new floor reached -> play the intro
        if (bannerT > 0f) bannerT -= Time.deltaTime;
        TrackMinimap();
    }

    void OnGUI()
    {
        if (!Bootstrap.InputReady)
        {
            GUI.color = new Color(1f, 0.55f, 0.55f);
            GUI.Label(new Rect(12, 8, 900, 24),
                "INPUT DISABLED — set Edit > Project Settings > Player > Active Input Handling to \"Both\", then press Play again.");
            GUI.color = Color.white;
            return;
        }

        if (boot != null && boot.title)
        {
            GUI.color = new Color(0.03f, 0.03f, 0.05f, 0.82f);                  // dim the frozen floor behind the title
            GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), Texture2D.whiteTexture);
            var ts = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter };
            ts.fontSize = 42;
            GUI.color = new Color(0.96f, 0.88f, 0.5f);
            GUI.Label(new Rect(0, Screen.height / 2f - 96f, Screen.width, 56f), "TRIAL TOWERS", ts);
            ts.fontSize = 15;
            GUI.color = new Color(0.82f, 0.84f, 0.92f);
            GUI.Label(new Rect(0, Screen.height / 2f - 28f, Screen.width, 24f), "Climb the tower · beat or bribe each gatekeeper · reach the Crown", ts);
            GUI.Label(new Rect(0, Screen.height / 2f + 2f, Screen.width, 24f), "WASD move · Space/LMB melee · RMB/Q ranged · Shift dash", ts);
            if (boot.best > 0)
            {
                ts.fontSize = 13;
                GUI.color = new Color(0.7f, 0.74f, 0.82f);
                GUI.Label(new Rect(0, Screen.height / 2f + 30f, Screen.width, 22f),
                    boot.best >= Bootstrap.FinalFloor ? "Best: the Crown — cleared" : "Best depth: Floor " + boot.best, ts);
            }
            ts.fontSize = 17;
            GUI.color = new Color(1f, 0.92f, 0.6f, 0.55f + 0.45f * Mathf.PingPong(Time.unscaledTime * 1.8f, 1f));   // pulse (unscaled — timeScale is 0)
            GUI.Label(new Rect(0, Screen.height / 2f + 56f, Screen.width, 28f), "Press Space to begin", ts);
            GUI.color = Color.white;
            return;
        }

        if (boot != null && boot.won)
        {
            var cs = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter };
            cs.fontSize = 24;
            GUI.color = new Color(0.96f, 0.86f, 0.42f);
            GUI.Label(new Rect(0, Screen.height / 2f - 64f, Screen.width, 36), "YOU REACHED THE TOWER'S CROWN", cs);
            cs.fontSize = 15;
            GUI.color = new Color(0.85f, 0.85f, 0.92f);
            GUI.Label(new Rect(0, Screen.height / 2f - 16f, Screen.width, 24),
                "Floor " + Bootstrap.FinalFloor + " conquered — the dimensions beyond await another climb.", cs);
            GUI.Label(new Rect(0, Screen.height / 2f + 14f, Screen.width, 24),
                "Coins banked: " + (player != null ? player.coins : 0) + "        Press R to begin a new run.", cs);
            GUI.color = Color.white;
            return;
        }

        if (player != null && player.hurtFlash > 0f)
        {
            var prevc = GUI.color;
            GUI.color = new Color(1f, 0f, 0f, Mathf.Clamp01(player.hurtFlash) * 0.4f);
            GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), Texture2D.whiteTexture);
            GUI.color = prevc;
        }

        var realm = Realms.For(floor);
        GUI.color = new Color(0.8f, 0.8f, 0.85f);
        GUI.Label(new Rect(12, 8, 700, 22), Realms.ActLabel(floor));
        GUI.color = Color.white;
        GUI.Label(new Rect(12, 28, 700, 22), "Floor " + floor + "  —  " + realm.name);

        if (player == null) return;

        Vitals();

        if (player.dead)
        {
            GUI.color = new Color(1f, 0.6f, 0.6f);
            GUI.Label(new Rect(12, 74, 700, 22), "YOU DIED — press R to re-roll the floor."
                + (boot != null && boot.best > 0 ? "      Best depth: Floor " + boot.best : ""));
            GUI.color = Color.white;
            return;
        }

        // the gatekeeper's cache (upgrade shop at the portal) takes over the prompt area while browsing
        if (boot != null && boot.choosing)
        {
            GUI.color = new Color(1f, 0.9f, 0.6f);
            GUI.Label(new Rect(12, 74, 940, 22), "GATEKEEPER'S CACHE — buy upgrades with coins, then press Enter to descend:");
            GUI.color = Color.white;
            for (int i = 0; i < 3; i++)
            {
                if (boot.cacheOffer == null || i >= boot.cacheOffer.Length) break;
                var b = Boons.All[boot.cacheOffer[i]];
                bool bought = boot.cacheBought != null && i < boot.cacheBought.Length && boot.cacheBought[i];
                bool afford = player.coins >= b.price;
                GUI.color = bought ? new Color(0.5f, 0.85f, 0.5f) : (afford ? Color.white : new Color(0.6f, 0.6f, 0.6f));
                string tail = bought ? "(owned)" : b.price + "c";
                GUI.Label(new Rect(28, 96 + i * 22, 940, 22), "[" + (i + 1) + "]  " + b.name + " — " + b.desc + "    " + tail);
            }
            GUI.color = Color.white;
            return;
        }

        GUI.Label(new Rect(12, 74, 980, 22),
            "Find the boss chamber · beat or bribe the gatekeeper · step into the portal     |     WASD move · Space/LMB melee · RMB/Q ranged · Shift dash · R re-roll");

        if (boot != null && boot.nearBoss)
        {
            GUI.color = new Color(1f, 0.9f, 0.6f);
            GUI.Label(new Rect(12, 98, 760, 22), boot.parleyOpen
                ? "GATEKEEPER:   [1] Bribe (" + boot.bribeCost + "c)      [2] Challenge"
                : "Press E — face the Gatekeeper (bribe it to pass, or fight)");
            GUI.color = Color.white;
        }

        BossBar();
        Minimap();
        FloorBanner();
    }

    // fog tracking for the minimap: reset on a fresh floor build (incl. R-reroll, via WorldGen.Gen),
    // then mark the room cell the player currently stands in (and reveal the boss chamber if entered)
    void TrackMinimap()
    {
        var rc = WorldGen.RoomCenters;
        if (rc == null) return;
        if (WorldGen.Gen != lastGen || visited == null || visited.Length != rc.Length)
        {
            lastGen = WorldGen.Gen;
            visited = new bool[rc.Length];
            bossFound = false;
        }
        var hero = Bootstrap.Hero;
        if (hero == null) return;
        Vector2 p = hero.transform.position;
        Vector2 hs = WorldGen.RoomSize * 0.5f;
        for (int i = 0; i < rc.Length; i++)
            if (Mathf.Abs(p.x - rc[i].x) <= hs.x && Mathf.Abs(p.y - rc[i].y) <= hs.y)
            {
                visited[i] = true;
                if (i == WorldGen.BossCell) bossFound = true;
            }
    }

    Vector2 WorldToMini(float wx, float wy)
    {
        Vector2 wh = WorldGen.WorldHalf;
        float nx = (wx + wh.x) / (2f * wh.x);
        float ny = (wy + wh.y) / (2f * wh.y);
        return new Vector2(mmX + nx * mmW, mmY + (1f - ny) * mmH);   // invert y (world up -> screen down)
    }

    // a top-right radar: room cells (explored brighter; boss chamber revealed red once entered) + the player dot
    void Minimap()
    {
        var rc = WorldGen.RoomCenters;
        if (rc == null || visited == null || visited.Length != rc.Length) return;

        mmW = 150f; mmH = 96f;
        mmX = Screen.width - mmW - 10f; mmY = 10f;

        GUI.color = new Color(0f, 0f, 0f, 0.5f);
        GUI.DrawTexture(new Rect(mmX - 3f, mmY - 3f, mmW + 6f, mmH + 6f), Texture2D.whiteTexture);

        Vector2 hs = WorldGen.RoomSize * 0.5f;
        for (int i = 0; i < rc.Length; i++)
        {
            Vector2 tl = WorldToMini(rc[i].x - hs.x, rc[i].y + hs.y);
            Vector2 br = WorldToMini(rc[i].x + hs.x, rc[i].y - hs.y);
            bool isBoss = i == WorldGen.BossCell;
            if (isBoss && bossFound) GUI.color = new Color(0.88f, 0.3f, 0.25f, 0.95f);   // revealed gatekeeper chamber
            else if (visited[i])     GUI.color = new Color(0.55f, 0.62f, 0.7f, 0.9f);    // explored
            else                     GUI.color = new Color(0.26f, 0.29f, 0.35f, 0.85f);  // unexplored (the boss hides among these)
            GUI.DrawTexture(new Rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y), Texture2D.whiteTexture);
        }

        var hero = Bootstrap.Hero;
        if (hero != null)
        {
            Vector2 pp = WorldToMini(hero.transform.position.x, hero.transform.position.y);
            GUI.color = new Color(0.55f, 0.85f, 1f);
            GUI.DrawTexture(new Rect(pp.x - 2.5f, pp.y - 2.5f, 5f, 5f), Texture2D.whiteTexture);
        }
        GUI.color = Color.white;
    }

    // player vitals: colour-coded HP bar + numeric, coins, and dash / ranged cooldown pips
    void Vitals()
    {
        float hpFrac = player.maxHp > 0f ? Mathf.Clamp01(player.hp / player.maxHp) : 0f;
        var cs = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter, fontSize = 11 };

        GUI.color = new Color(0f, 0f, 0f, 0.5f);                                    // HP backing
        GUI.DrawTexture(new Rect(12, 52, 204, 18), Texture2D.whiteTexture);
        GUI.color = hpFrac > 0.5f ? new Color(0.4f, 0.8f, 0.35f)
                  : (hpFrac > 0.25f ? new Color(0.92f, 0.82f, 0.3f) : new Color(0.92f, 0.36f, 0.3f));
        GUI.DrawTexture(new Rect(14, 54, 200f * hpFrac, 14), Texture2D.whiteTexture);
        GUI.color = Color.white;
        GUI.Label(new Rect(14, 53, 200, 15), Mathf.CeilToInt(player.hp) + " / " + Mathf.CeilToInt(player.maxHp), cs);

        GUI.Label(new Rect(224, 52, 90, 18), "Coins: " + player.coins);
        Pip(322f, "DASH", player.DashReady);
        Pip(392f, "SHOT", player.RangedReady);
    }

    void Pip(float x, string label, float ready)
    {
        GUI.color = new Color(0f, 0f, 0f, 0.5f);
        GUI.DrawTexture(new Rect(x, 52, 64, 18), Texture2D.whiteTexture);
        GUI.color = ready >= 1f ? new Color(0.5f, 0.85f, 1f) : new Color(0.32f, 0.42f, 0.52f);   // bright when ready
        GUI.DrawTexture(new Rect(x + 2f, 54, 60f * Mathf.Clamp01(ready), 14), Texture2D.whiteTexture);
        GUI.color = Color.white;
        var cs = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter, fontSize = 10 };
        GUI.Label(new Rect(x, 53, 64, 15), label, cs);
    }

    // a brief act / floor / realm card that fades in and out on arrival at a new floor
    void FloorBanner()
    {
        if (bannerT <= 0f) return;
        float a = Mathf.Clamp01(Mathf.Min(bannerT / 0.6f, (BannerDur - bannerT) / 0.4f));   // fade in 0.4s, hold, fade out 0.6s
        var realm = Realms.For(floor);
        var cs = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter };
        float cy = Screen.height * 0.34f;

        cs.fontSize = 16;
        GUI.color = new Color(0.85f, 0.78f, 0.55f, a);
        GUI.Label(new Rect(0, cy - 34f, Screen.width, 22f), Realms.ActLabel(floor), cs);
        cs.fontSize = 34;
        GUI.color = new Color(0.96f, 0.93f, 0.85f, a);
        GUI.Label(new Rect(0, cy, Screen.width, 46f), "FLOOR " + floor, cs);
        cs.fontSize = 18;
        GUI.color = new Color(0.8f, 0.85f, 0.95f, a);
        GUI.Label(new Rect(0, cy + 46f, Screen.width, 26f), realm.name, cs);
        GUI.color = Color.white;
    }

    // a top-centre health bar for the gatekeeper once the fight is on (Unity == treats a destroyed boss as null)
    void BossBar()
    {
        var b = boot != null ? boot.CurrentBoss : null;
        if (b == null || !b.provoked) return;

        float frac = b.maxHp > 0f ? Mathf.Clamp01(b.hp / b.maxHp) : 0f;
        float bw = Mathf.Min(440f, Screen.width - 80f);
        float bx = (Screen.width - bw) / 2f;
        float by = 30f;   // leaves room above for the title (by - 18)

        var cs = new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter, fontSize = 12 };
        GUI.color = new Color(1f, 0.85f, 0.6f);
        GUI.Label(new Rect(bx, by - 18f, bw, 16f), "THE GATEKEEPER — " + Realms.For(floor).name, cs);

        GUI.color = new Color(0f, 0f, 0f, 0.55f);                                   // backing
        GUI.DrawTexture(new Rect(bx - 2f, by - 2f, bw + 4f, 18f), Texture2D.whiteTexture);
        GUI.color = frac > 0.35f ? new Color(0.85f, 0.3f, 0.25f) : new Color(1f, 0.55f, 0.18f);   // orange once in enrage range
        GUI.DrawTexture(new Rect(bx, by, bw * frac, 14f), Texture2D.whiteTexture);
        GUI.color = new Color(1f, 0.9f, 0.4f, 0.9f);                                // enrage threshold tick at 35%
        GUI.DrawTexture(new Rect(bx + bw * 0.35f, by - 2f, 2f, 18f), Texture2D.whiteTexture);
        GUI.color = Color.white;
    }
}
