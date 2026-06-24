using UnityEngine;

[RequireComponent(typeof(Rigidbody2D))]
public class Player : MonoBehaviour
{
    public float speed = 6.5f;
    public float hp = 100f, maxHp = 100f;
    public float atkRange = 1.7f, atkDmg = 30f, atkCd = 0.30f;
    public bool dead;

    Rigidbody2D rb;
    Vector2 face = Vector2.down;
    float cd, iframe;

    void Awake()
    {
        rb = GetComponent<Rigidbody2D>();
    }

    void Update()
    {
        if (cd > 0f) cd -= Time.deltaTime;
        if (iframe > 0f) iframe -= Time.deltaTime;
        if (dead || !Bootstrap.InputReady) return;
        if ((Input.GetKeyDown(KeyCode.Space) || Input.GetMouseButtonDown(0)) && cd <= 0f)
            Attack();
    }

    void FixedUpdate()
    {
        if (dead || !Bootstrap.InputReady) { rb.linearVelocity = Vector2.zero; return; }
        Vector2 mv = new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
        if (mv.sqrMagnitude > 1f) mv.Normalize();
        if (mv.sqrMagnitude > 0.01f) face = mv.normalized;
        rb.linearVelocity = mv * speed;
    }

    void Attack()
    {
        cd = atkCd;
        Vector2 c = rb.position + face * (atkRange * 0.55f);
        var hits = Physics2D.OverlapCircleAll(c, atkRange * 0.7f);
        foreach (var h in hits)
        {
            var w = h.GetComponent<Wall>();
            if (w != null) { w.TakeDamage(atkDmg * 0.6f + 8f); continue; }
            var e = h.GetComponent<Enemy>();
            if (e != null) e.TakeDamage(atkDmg);
        }
    }

    // i-frames prevent contact damage from chip-killing across physics steps
    public void Hurt(float d)
    {
        if (dead || iframe > 0f) return;
        hp = Mathf.Max(0f, hp - d);
        iframe = 0.5f;
        if (hp <= 0f)
        {
            dead = true;
            if (rb != null) rb.linearVelocity = Vector2.zero;
        }
    }
}
