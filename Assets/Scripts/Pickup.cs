using UnityEngine;

// A collectable orb (health or coins) that bobs in place; the player walks over it to grab it.
// Parented to the floor's world root, so any uncollected orbs clear when the floor regenerates.
[RequireComponent(typeof(SpriteRenderer))]
public class Pickup : MonoBehaviour
{
    public int healAmount, coinAmount;

    Vector3 home;
    float t;

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
        transform.position = home + Vector3.up * (0.12f * Mathf.Sin(t * 4f));
    }

    void OnTriggerEnter2D(Collider2D c)
    {
        var p = c.GetComponent<Player>();
        if (p == null || p.dead) return;
        if (healAmount > 0) p.hp = Mathf.Min(p.maxHp, p.hp + healAmount);
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
