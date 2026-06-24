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

        GUI.Label(new Rect(12, 74, 900, 22),
            "Find the boss chamber · beat or bribe the gatekeeper · step into the portal     |     WASD: move · Space/LMB: attack · R: re-roll");

        if (boot != null && boot.nearBoss)
        {
            GUI.color = new Color(1f, 0.9f, 0.6f);
            GUI.Label(new Rect(12, 98, 760, 22), boot.parleyOpen
                ? "GATEKEEPER:   [1] Bribe (" + boot.bribeCost + "c)      [2] Challenge"
                : "Press E — face the Gatekeeper (bribe it to pass, or fight)");
            GUI.color = Color.white;
        }
    }
}
