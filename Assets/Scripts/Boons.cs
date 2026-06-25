using UnityEngine;
using System;

// The gatekeeper's cache: a small catalog of permanent upgrades the player buys with coins
// at the portal before descending. This is the run's power-growth hook and the coin sink.
public static class Boons
{
    public struct Boon { public string name; public string desc; public int price; public Action<Player> apply; }

    // No pure-heal boons: each descend already restores full HP, so they'd be dead picks.
    public static readonly Boon[] All =
    {
        new Boon { name = "Vitality",  desc = "+25 Max HP",          price = 25, apply = p => { p.maxHp += 25f; p.hp = p.maxHp; } },
        new Boon { name = "Power",     desc = "+20% attack damage",  price = 30, apply = p => { p.atkDmg *= 1.2f; } },
        new Boon { name = "Swiftness", desc = "+0.8 move speed",     price = 25, apply = p => { p.speed += 0.8f; } },
        new Boon { name = "Frenzy",    desc = "-15% attack cooldown",price = 30, apply = p => { p.atkCd *= 0.85f; } },
        new Boon { name = "Evasion",   desc = "-20% dash cooldown",  price = 20, apply = p => { p.dashCd *= 0.8f; } },
        new Boon { name = "Reach",     desc = "+0.4 attack range",   price = 25, apply = p => { p.atkRange += 0.4f; } },
        new Boon { name = "Overcharge",desc = "-25% Nova cooldown",  price = 28, apply = p => { p.novaCd *= 0.75f; } },
    };

    // three distinct boon indices for one cache offering
    public static int[] RollOffer()
    {
        int n = All.Length;
        int a = Random.Range(0, n);
        int b = (a + 1 + Random.Range(0, n - 1)) % n;                       // always != a
        int c = (a + 1 + Random.Range(0, n - 1)) % n;                       // always != a
        while (c == b) c = (a + 1 + Random.Range(0, n - 1)) % n;            // re-roll until != b too (n>=3 guarantees one)
        return new[] { a, b, c };
    }
}
