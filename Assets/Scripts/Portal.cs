using UnityEngine;

// The floor's exit. Dormant (dim) until the gatekeeper falls, then it pulses bright and,
// when the player steps in, fires onEnter (Bootstrap descends to a fresh floor).
[RequireComponent(typeof(SpriteRenderer))]
public class Portal : MonoBehaviour
{
    public bool open;
    public System.Action onEnter;

    SpriteRenderer sr;
    float t;

    void Awake()
    {
        sr = GetComponent<SpriteRenderer>();
        var col = gameObject.AddComponent<CircleCollider2D>();
        col.isTrigger = true;
        col.radius = 0.6f;
    }

    public void Open() { open = true; }

    void Update()
    {
        t += Time.deltaTime;
        if (sr == null) return;
        if (open)
        {
            float p = 0.6f + 0.4f * Mathf.Sin(t * 4f);
            sr.color = new Color(0.45f * p, 0.85f * p, 1f * p);
            transform.localScale = Vector3.one * (1.6f + 0.15f * Mathf.Sin(t * 4f));
        }
        else
        {
            sr.color = new Color(0.18f, 0.18f, 0.26f);
        }
    }

    void OnTriggerEnter2D(Collider2D c)
    {
        if (open && c.GetComponent<Player>() != null && onEnter != null) onEnter();
    }
}
