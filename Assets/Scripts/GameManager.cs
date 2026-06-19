using UnityEngine;
using UnityEngine.UI;

// Singleton that owns the on-screen UI and shared game state.
public class GameManager : MonoBehaviour
{
    public static GameManager I;

    Text killsText, hintText, dialogueText, toastText;
    Image hpFill;
    GameObject dialoguePanel;
    int kills;
    float toastTimer;

    void Awake() { I = this; }

    public void BuildUI()
    {
        var canvasGO = new GameObject("Canvas", typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
        canvasGO.transform.SetParent(transform);
        var canvas = canvasGO.GetComponent<Canvas>();
        canvas.renderMode = RenderMode.ScreenSpaceOverlay;
        var scaler = canvasGO.GetComponent<CanvasScaler>();
        scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
        scaler.referenceResolution = new Vector2(960, 540);

        // HP bar (background + fill)
        var hpBg = Panel(canvasGO.transform, new Color(0, 0, 0, 0.6f),
            new Vector2(0, 1), new Vector2(20, -20), new Vector2(220, 26));
        hpFill = Panel(hpBg.transform, new Color(0.85f, 0.2f, 0.25f, 1f),
            new Vector2(0, 0.5f), new Vector2(3, 0), new Vector2(214, 20)).GetComponent<Image>();
        hpFill.rectTransform.pivot = new Vector2(0, 0.5f);
        hpFill.rectTransform.anchorMin = new Vector2(0, 0.5f);
        hpFill.rectTransform.anchorMax = new Vector2(0, 0.5f);

        killsText = Label(canvasGO.transform, "Slimes defeated: 0", 22, TextAnchor.UpperRight,
            new Vector2(1, 1), new Vector2(-20, -18), new Vector2(360, 30));
        hintText = Label(canvasGO.transform, "WASD / Arrows move   •   Space attack   •   E talk",
            18, TextAnchor.LowerCenter, new Vector2(0.5f, 0), new Vector2(0, 16), new Vector2(700, 26));
        hintText.color = new Color(1, 1, 1, 0.65f);

        toastText = Label(canvasGO.transform, "", 30, TextAnchor.MiddleCenter,
            new Vector2(0.5f, 0.5f), new Vector2(0, 120), new Vector2(700, 50));
        toastText.color = new Color(1f, 0.9f, 0.4f, 0f);

        // Dialogue box (hidden until you talk to an NPC)
        dialoguePanel = Panel(canvasGO.transform, new Color(0.05f, 0.05f, 0.1f, 0.92f),
            new Vector2(0.5f, 0), new Vector2(0, 90), new Vector2(640, 120));
        dialogueText = Label(dialoguePanel.transform, "", 20, TextAnchor.MiddleLeft,
            new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(600, 100));
        dialoguePanel.SetActive(false);

        UpdateKills(0);
    }

    public void ShowDialogue(string s) { dialoguePanel.SetActive(true); dialogueText.text = s; }
    public void HideDialogue() { dialoguePanel.SetActive(false); }

    public void Toast(string s) { toastText.text = s; toastTimer = 1.6f; }

    public void AddKill()
    {
        kills++;
        UpdateKills(kills);
        if (kills == 1) Toast("First blood!");
        if (kills == 5) Toast("Slime slayer!");
    }
    void UpdateKills(int k) { if (killsText) killsText.text = "Slimes defeated: " + k; }

    public void SetHealth(float frac)
    {
        if (hpFill) hpFill.rectTransform.sizeDelta = new Vector2(214 * Mathf.Clamp01(frac), 20);
    }

    void Update()
    {
        if (toastTimer > 0)
        {
            toastTimer -= Time.deltaTime;
            var c = toastText.color;
            c.a = Mathf.Clamp01(toastTimer);
            toastText.color = c;
        }
    }

    // ---- tiny uGUI builders ----
    GameObject Panel(Transform parent, Color color, Vector2 anchor, Vector2 anchoredPos, Vector2 size)
    {
        var go = new GameObject("Panel", typeof(Image));
        go.transform.SetParent(parent, false);
        var img = go.GetComponent<Image>();
        img.color = color;
        var rt = img.rectTransform;
        rt.anchorMin = rt.anchorMax = anchor;
        rt.pivot = anchor;
        rt.anchoredPosition = anchoredPos;
        rt.sizeDelta = size;
        return go;
    }

    Text Label(Transform parent, string text, int size, TextAnchor align,
        Vector2 anchor, Vector2 anchoredPos, Vector2 boxSize)
    {
        var go = new GameObject("Label", typeof(Text));
        go.transform.SetParent(parent, false);
        var t = go.GetComponent<Text>();
        t.text = text;
        t.font = Art.Font();
        t.fontSize = size;
        t.alignment = align;
        t.color = Color.white;
        t.horizontalOverflow = HorizontalWrapMode.Wrap;
        t.verticalOverflow = VerticalWrapMode.Overflow;
        var rt = t.rectTransform;
        rt.anchorMin = rt.anchorMax = rt.pivot = anchor;
        rt.anchoredPosition = anchoredPos;
        rt.sizeDelta = boxSize;
        return t;
    }
}
