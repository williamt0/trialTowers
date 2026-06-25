using UnityEngine;

// Minimal on-screen HUD via IMGUI (no UI prefab needed). Also surfaces the one
// project-setting fix if legacy input is disabled, so the slice is self-documenting.
public class GameHUD : MonoBehaviour
{
    public Player player;
    public Bootstrap boot;
    public int floor = 1;

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

        GUI.Label(new Rect(12, 52, 600, 22),
            "HP: " + Mathf.CeilToInt(player.hp) + " / " + Mathf.CeilToInt(player.maxHp) + "      Coins: " + player.coins);

        if (player.dead)
        {
            GUI.color = new Color(1f, 0.6f, 0.6f);
            GUI.Label(new Rect(12, 74, 600, 22), "YOU DIED — press R to re-roll the floor.");
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
