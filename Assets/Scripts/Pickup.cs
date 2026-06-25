using UnityEngine;

// A collectable orb (health or coins) that bobs in place; the player walks over it to grab it.
// Parented to the floor's world root, so any uncollected orbs clear when the floor regenerates.
[RequireComponent(typeof(SpriteRenderer))]
public class Pickup : MonoBehaviour
{
    public int healAmount, coinAmount;
    const float MagnetR = 3.6f;   // starts homing toward the player within this range

    Vector3 home;
    float t;
    bool collected;

    void Awake()
    {
        home = transform.position;
        var col = gameObject.AddComponent<CircleCollider2D>();
        col.isTrigger = true;
        col.radius = 1.2f;   // local; the 0.45 scale makes it ~0.5 world
    }

    void Update()
    {
        t += Time.deltaTime;
        var hero = Bootstrap.Hero;
        if (hero != null && !hero.dead && !Bootstrap.Paused)
        {
            float d = Vector2.Distance(transform.position, hero.transform.position);
            if (d < 0.55f) { Collect(hero); return; }        // close enough — grab it (robust even if the trigger doesn't re-fire)
            if (d < MagnetR)
            {
                float pull = Mathf.Lerp(9f, 3.5f, d / MagnetR);   // accelerates as it nears
                transform.position = Vector3.MoveTowards(transform.position, hero.transform.position, pull * Time.deltaTime);
                home = transform.position;                    // re-anchor the bob so it doesn't snap back if it leaves range
                return;
            }
        }
        transform.position = home + Vector3.up * (0.12f * Mathf.Sin(t * 4f));
    }

    void OnTriggerEnter2D(Collider2D c)
    {
        var p = c.GetComponent<Player>();
        if (p != null && !p.dead) Collect(p);
    }

    void Collect(Player p)
    {
        if (collected) return;   // guard against trigger + proximity firing in the same frame
        collected = true;
        if (healAmount > 0)
        {
            float before = p.hp;
            p.hp = Mathf.Min(p.maxHp, p.hp + healAmount);
            int healed = Mathf.RoundToInt(p.hp - before);
            if (healed > 0) FloatingText.Spawn(transform.position, "+" + healed, new Color(0.5f, 0.95f, 0.5f), 15f);
        }
        if (coinAmount > 0) p.coins += coinAmount;
        CameraFollow.Kick(0.04f);
        Destroy(gameObject);
    }

    public static void Spawn(Transform parent, Vector2 pos, int heal, int coins, Color col)
    {
        var go = SpriteFactory.Quad(heal > 0 ? "Health" : "Coin", pos, new Vector2(0.45f, 0.45f), col, 6);
        if (parent != null) go.transform.SetParent(parent);
        var pk = go.AddComponent<Pickup>();
        pk.healAmount = heal;
        pk.coinAmount = coins;
    }
}
