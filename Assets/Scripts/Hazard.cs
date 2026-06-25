using UnityEngine;

// Scorched ground on deeper floors. Singes the player while they stand in it (player-only;
// enemies ignore it). The damage cadence is gated inside Player.Burn so it pulses, not drains.
[RequireComponent(typeof(SpriteRenderer))]
public class Hazard : MonoBehaviour
{
    public float dmg = 9f;

    void Awake()
    {
        var c = gameObject.AddComponent<CircleCollider2D>();
        c.isTrigger = true;
        c.radius = 0.45f;   // local; scales with the tile's quad size so a bigger tile covers more ground
    }

    void OnTriggerStay2D(Collider2D other)
    {
        var p = other.GetComponent<Player>();
        if (p != null) p.Burn(dmg);   // Player gates this to one pulse per ~0.45s
    }
}
