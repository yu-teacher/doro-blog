package com.doro.blog.domain.upload.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SvgSanitizerTest {

    private static final String NS = "xmlns=\"http://www.w3.org/2000/svg\"";

    private String clean(String svg) {
        return new String(SvgSanitizer.sanitize(svg.getBytes(StandardCharsets.UTF_8)), StandardCharsets.UTF_8);
    }

    private void assertRejected(String svg) {
        assertThatThrownBy(() -> SvgSanitizer.sanitize(svg.getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(BlogException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_FILE_TYPE);
    }

    @Test
    @DisplayName("일반적인 안전한 SVG 는 그대로(요소/속성 유지) 통과한다")
    void keepsBenignSvg() {
        String out = clean("<svg " + NS + " viewBox=\"0 0 24 24\" width=\"24\" height=\"24\">"
                + "<defs><linearGradient id=\"g1\"><stop offset=\"0\" stop-color=\"#f00\"/></linearGradient></defs>"
                + "<g transform=\"translate(1 1)\"><path d=\"M0 0L10 10\" fill=\"url(#g1)\" stroke=\"#000\" stroke-width=\"2\"/>"
                + "<circle cx=\"5\" cy=\"5\" r=\"3\" opacity=\"0.5\"/><text x=\"1\" y=\"2\">안녕 Hello</text></g></svg>");
        assertThat(out).contains("<svg", "viewBox=\"0 0 24 24\"", "<path", "fill=\"url(#g1)\"", "<circle", "안녕 Hello", "linearGradient");
        assertThat(out).contains("xmlns=\"http://www.w3.org/2000/svg\"");
    }

    @Test
    @DisplayName("script 요소는 내용째 제거한다 (대소문자/CDATA 우회 포함)")
    void removesScript() {
        assertThat(clean("<svg " + NS + "><script>alert(1)</script><rect width=\"1\" height=\"1\"/></svg>"))
                .doesNotContain("script", "alert").contains("<rect");
        assertThat(clean("<svg " + NS + "><script><![CDATA[alert(1)]]></script></svg>")).doesNotContain("alert", "script");
        assertThat(clean("<svg " + NS + "><SCRIPT>alert(1)</SCRIPT><rect width=\"1\"/></svg>")).doesNotContain("alert");
        assertThat(clean("<svg " + NS + "><g><script href=\"//evil.test/x.js\"/></g></svg>")).doesNotContain("script", "evil");
    }

    @Test
    @DisplayName("on* 이벤트 핸들러 속성은 제거한다")
    void removesEventHandlers() {
        String out = clean("<svg " + NS + " onload=\"alert(1)\"><rect width=\"1\" onclick=\"alert(2)\" onmouseover=\"x()\" height=\"1\"/></svg>");
        assertThat(out).doesNotContain("onload", "onclick", "onmouseover", "alert").contains("<rect");
    }

    @Test
    @DisplayName("foreignObject, a, animate, set, iframe, image 같은 허용되지 않은 요소는 하위 요소째 버린다")
    void dropsDisallowedElements() {
        String out = clean("<svg " + NS + ">"
                + "<foreignObject><body xmlns=\"http://www.w3.org/1999/xhtml\"><script>alert(1)</script></body></foreignObject>"
                + "<a href=\"javascript:alert(1)\"><rect width=\"1\" height=\"1\"/></a>"
                + "<animate attributeName=\"href\" values=\"javascript:alert(1)\"/>"
                + "<set attributeName=\"onload\" to=\"alert(1)\"/>"
                + "<image href=\"https://evil.test/track.png\"/>"
                + "<circle r=\"1\"/></svg>");
        assertThat(out).doesNotContain("foreignObject", "<a", "animate", "<set", "image", "evil", "alert").contains("<circle");
    }

    @Test
    @DisplayName("href 는 같은 문서 안(#id)만 허용한다 (javascript:, data:, 외부 주소, xlink:href 포함)")
    void restrictsHref() {
        String out = clean("<svg " + NS + " xmlns:xlink=\"http://www.w3.org/1999/xlink\">"
                + "<defs><rect id=\"r\" width=\"1\" height=\"1\"/></defs>"
                + "<use href=\"#r\"/>"
                + "<use xlink:href=\"#r\" x=\"2\"/>"
                + "<use href=\"https://evil.test/a.svg#x\"/>"
                + "<use href=\"javascript:alert(1)\"/>"
                + "<use xlink:href=\"data:image/svg+xml;base64,PHN2Zz4=\"/></svg>");
        assertThat(out).doesNotContain("evil", "javascript", "data:", "xlink");
        assertThat(out.split("href=\"#r\"", -1).length - 1).isEqualTo(2);
    }

    @Test
    @DisplayName("url() 은 문서 내부(#id)만, 스타일/속성의 외부 리소스와 javascript: 는 제거한다")
    void blocksExternalUrls() {
        String out = clean("<svg " + NS + ">"
                + "<rect width=\"1\" height=\"1\" fill=\"url(https://evil.test/x)\" style=\"background:url(//evil.test/y)\"/>"
                + "<rect width=\"2\" height=\"2\" fill=\"url(#ok)\" style=\"fill:red;stroke:blue\"/>"
                + "<rect width=\"3\" style=\"fill:expression(alert(1))\"/></svg>");
        assertThat(out).doesNotContain("evil", "expression", "alert").contains("url(#ok)", "fill:red");
    }

    @Test
    @DisplayName("style 요소: 안전한 CSS 는 유지, @import/url()/expression 이 있으면 요소째 제거")
    void sanitizesStyleElement() {
        assertThat(clean("<svg " + NS + "><style>.a{fill:red}</style><rect class=\"a\" width=\"1\"/></svg>"))
                .contains("<style>.a{fill:red}</style>");
        assertThat(clean("<svg " + NS + "><style>@import url(https://evil.test/a.css);</style><rect width=\"1\"/></svg>"))
                .doesNotContain("style", "evil", "import").contains("<rect");
        assertThat(clean("<svg " + NS + "><style>.a{background:url(https://evil.test/p.png)}</style></svg>")).doesNotContain("evil");
        assertThat(clean("<svg " + NS + "><style>.a{width:expression(alert(1))}</style></svg>")).doesNotContain("expression");
    }

    @Test
    @DisplayName("DOCTYPE/외부 엔티티(XXE)와 엔티티 폭탄은 파싱 단계에서 거부한다")
    void rejectsDoctypeAndEntities() {
        assertRejected("<?xml version=\"1.0\"?><!DOCTYPE svg [<!ENTITY xxe SYSTEM \"file:///etc/passwd\">]><svg " + NS + "><text>&xxe;</text></svg>");
        assertRejected("<!DOCTYPE svg [<!ENTITY a \"aaaa\"><!ENTITY b \"&a;&a;&a;&a;\">]><svg " + NS + "><text>&b;</text></svg>");
        assertRejected("<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://evil.test/svg.dtd\"><svg " + NS + "/>");
    }

    @Test
    @DisplayName("SVG 가 아니거나 네임스페이스가 없거나 깨진 XML 은 거부한다")
    void rejectsNonSvg() {
        assertRejected("<html><body>hi</body></html>");
        assertRejected("<svg><rect/></svg>");                       // SVG 네임스페이스 없음
        assertRejected("<svg " + NS + "><rect></svg>");             // 깨진 XML
        assertRejected("not xml at all");
        assertRejected("<foo xmlns=\"http://www.w3.org/2000/svg\"/>");
        assertThatThrownBy(() -> SvgSanitizer.sanitize(new byte[0])).isInstanceOf(BlogException.class);
        assertThatThrownBy(() -> SvgSanitizer.sanitize(null)).isInstanceOf(BlogException.class);
    }

    @Test
    @DisplayName("너무 크거나 너무 깊거나 노드가 너무 많은 SVG 는 거부한다")
    void rejectsOversizedInput() {
        assertThatThrownBy(() -> SvgSanitizer.sanitize(new byte[SvgSanitizer.MAX_SVG_BYTES + 1])).isInstanceOf(BlogException.class);

        StringBuilder deep = new StringBuilder("<svg " + NS + ">");
        for (int i = 0; i < 60; i++) deep.append("<g>");
        for (int i = 0; i < 60; i++) deep.append("</g>");
        deep.append("</svg>");
        assertRejected(deep.toString());

        StringBuilder wide = new StringBuilder("<svg " + NS + ">");
        for (int i = 0; i < 5_100; i++) wide.append("<g/>");
        wide.append("</svg>");
        assertRejected(wide.toString());
    }

    @Test
    @DisplayName("주석/처리 명령/허용 목록 밖 속성과 네임스페이스 속성은 버리고, 안전한 id 만 남긴다")
    void dropsCommentsUnknownAttributesAndUnsafeIds() {
        String out = clean("<svg " + NS + " xmlns:evil=\"http://evil.test\" data-x=\"1\" evil:attr=\"x\"><!-- <script>alert(1)</script> -->"
                + "<?php echo 1 ?><rect id=\"a b\" width=\"1\" formaction=\"x\" height=\"1\"/><rect id=\"ok_1\" width=\"1\"/></svg>");
        assertThat(out).doesNotContain("<!--", "<?php", "evil", "data-x", "formaction", "id=\"a b\"").contains("id=\"ok_1\"");
    }

    @Test
    @DisplayName("정제 결과를 다시 정제해도 같다 (멱등)")
    void sanitizingIsIdempotent() {
        String once = clean("<svg " + NS + " onload=\"x\"><script>1</script><path d=\"M0 0L1 1\"/></svg>");
        assertThat(clean(once)).isEqualTo(once);
    }

    @Test
    @DisplayName("XML 선언/BOM/공백이 앞에 있어도 처리한다")
    void toleratesPrologue() {
        assertThat(clean("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n  <svg " + NS + "><path d=\"M0 0\"/></svg>")).contains("<path");
    }
}
