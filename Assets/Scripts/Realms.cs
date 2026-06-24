using UnityEngine;

// The 10 themed floors, grouped into the four acts (ports the v2 REALMS + actFor framing).
// Each floor recolours the ground + roads; the HUD shows the act and realm name.
public static class Realms
{
    public struct Realm
    {
        public string name;
        public int act;
        public Color ground;   // base floor
        public Color road;     // street colour
        public Color accent;   // realm tint hint (reserved for later)
    }

    static readonly Realm[] R =
    {
        new Realm { name = "The Trial Grounds",          act = 1, ground = new Color(0.13f, 0.14f, 0.12f), road = new Color(0.29f, 0.27f, 0.21f), accent = new Color(0.60f, 0.80f, 0.50f) },
        new Realm { name = "The Verdant Jungle",         act = 2, ground = new Color(0.09f, 0.14f, 0.09f), road = new Color(0.22f, 0.26f, 0.16f), accent = new Color(0.40f, 0.80f, 0.40f) },
        new Realm { name = "The Human Empire",           act = 2, ground = new Color(0.11f, 0.13f, 0.17f), road = new Color(0.27f, 0.27f, 0.30f), accent = new Color(0.50f, 0.70f, 0.95f) },
        new Realm { name = "The Beast Empire",           act = 2, ground = new Color(0.16f, 0.12f, 0.09f), road = new Color(0.30f, 0.24f, 0.17f), accent = new Color(0.95f, 0.60f, 0.25f) },
        new Realm { name = "The Elves Forest",           act = 2, ground = new Color(0.10f, 0.14f, 0.11f), road = new Color(0.22f, 0.27f, 0.20f), accent = new Color(0.50f, 0.85f, 0.45f) },
        new Realm { name = "The Mob Empire",             act = 2, ground = new Color(0.15f, 0.08f, 0.11f), road = new Color(0.26f, 0.18f, 0.20f), accent = new Color(0.80f, 0.35f, 0.65f) },
        new Realm { name = "Peak of the Two Families",   act = 3, ground = new Color(0.14f, 0.13f, 0.09f), road = new Color(0.30f, 0.28f, 0.20f), accent = new Color(0.95f, 0.88f, 0.55f) },
        new Realm { name = "Court of the Upper Beings",  act = 4, ground = new Color(0.10f, 0.08f, 0.14f), road = new Color(0.22f, 0.18f, 0.30f), accent = new Color(0.72f, 0.50f, 1.00f) },
        new Realm { name = "The Hall of Echoes",         act = 4, ground = new Color(0.10f, 0.12f, 0.16f), road = new Color(0.24f, 0.26f, 0.30f), accent = new Color(0.60f, 0.85f, 1.00f) },
        new Realm { name = "The Tower's Crown",          act = 4, ground = new Color(0.14f, 0.12f, 0.07f), road = new Color(0.32f, 0.28f, 0.18f), accent = new Color(1.00f, 0.90f, 0.60f) },
    };

    public static Realm For(int floorNum)
    {
        int i = Mathf.Clamp(floorNum - 1, 0, R.Length - 1);   // beyond floor 10 stays on the Crown (harder loops later)
        return R[i];
    }

    public static string ActLabel(int floorNum)
    {
        if (floorNum <= 1) return "ACT I  ·  THE TRIAL";
        if (floorNum <= 6) return "ACT II  ·  THE MORTAL WORLD";
        if (floorNum == 7) return "ACT III  ·  THE TWO FAMILIES";
        return "ACT IV  ·  THE DIMENSIONS BEYOND";
    }
}
