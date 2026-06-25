using UnityEngine;

// AoE damage helper (barrel explosions). Hits the player, enemies, and an already-provoked boss
// within a radius. It deliberately does NOT damage other Props, so a barrel can never detonate an
// adjacent barrel — there is no synchronous Break->Explode->Break recursion, hence no stack overflow.
public static class Damage
{
    public static void Explode(Vector2 center, float radius, float dmg)
    {
        var hits = Physics2D.OverlapCircleAll(center, radius);
        foreach (var h in hits)
        {
            var pl = h.GetComponent<Player>();
            if (pl != null) { pl.Hurt(dmg, center); continue; }      // self-damage is a fair point-blank risk (Hurt has its own i-frames)
            var e = h.GetComponent<Enemy>();
            if (e != null) { e.TakeDamage(dmg, center); continue; }
            var b = h.GetComponent<Boss>();
            if (b != null && b.provoked) b.TakeDamage(dmg, center);  // gated like Nova: never silently provokes a neutral gatekeeper
            // Props intentionally untouched -> no barrel chaining
        }
        CameraFollow.Kick(0.3f);
        NovaRing.Spawn(Bootstrap.WorldRoot, center, radius, new Color(1f, 0.55f, 0.2f, 0.55f));   // orange blast
    }
}
