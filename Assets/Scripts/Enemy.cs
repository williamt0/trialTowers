using UnityEngine;

public class Enemy : MonoBehaviour
{
    public float speed = 2.2f;
    public float sightRange = 5f;
    public float health = 70f;
    public float touchDamage = 12f;

    Rigidbody2D rb;
    SpriteRenderer sr;
    Transform player;
    Vector2 wanderDir;
    float wanderTimer;
    float hitFlash;
    float touchCooldown;
    Color baseColor;

    void Awake()
    {
        rb = GetComponent<Rigidbody2D>();
        sr = GetComponent<SpriteRenderer>();
        baseColor = sr.color;
        PickWander();
    }

    void Start()
    {
        var p = FindObjectOfType<PlayerController>();
        if (p) player = p.transform;
    }

    void FixedUpdate()
    {
        Vector2 dir;
        if (player != null && Vector2.Distance(rb.position, player.position) < sightRange)
        {
            dir = ((Vector2)player.position - rb.position).normalized; // chase
        }
        else
        {
            wanderTimer -= Time.fixedDeltaTime;
            if (wanderTimer <= 0f) PickWander();
            dir = wanderDir;
        }
        rb.MovePosition(rb.position + dir * speed * Time.fixedDeltaTime);

        // squishy bob so slimes feel alive
        float bob = 1f + Mathf.Sin(Time.time * 8f) * 0.06f;
        transform.localScale = new Vector3(1.1f / bob, 1f * bob, 1f);
    }

    void Update()
    {
        if (hitFlash > 0f)
        {
            hitFlash -= Time.deltaTime;
            sr.color = Color.Lerp(baseColor, Color.white, Mathf.Clamp01(hitFlash * 6f));
        }
        if (touchCooldown > 0f) touchCooldown -= Time.deltaTime;
    }

    void PickWander()
    {
        wanderDir = Random.insideUnitCircle.normalized;
        wanderTimer = Random.Range(1f, 2.5f);
    }

    public void TakeHit(float dmg, Vector2 knockDir)
    {
        health -= dmg;
        hitFlash = 0.25f;
        rb.position += knockDir.normalized * 0.4f;
        if (health <= 0f)
        {
            GameManager.I.AddKill();
            Destroy(gameObject);
        }
    }

    void OnCollisionStay2D(Collision2D c)
    {
        if (touchCooldown > 0f) return;
        var pc = c.collider.GetComponent<PlayerController>();
        if (pc != null)
        {
            pc.Damage(touchDamage, rb.position);
            touchCooldown = 0.8f;
        }
    }
}
