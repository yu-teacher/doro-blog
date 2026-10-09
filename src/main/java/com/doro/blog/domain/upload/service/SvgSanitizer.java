package com.doro.blog.domain.upload.service;

import com.doro.blog.common.exception.BlogException;
import com.doro.blog.common.exception.ErrorCode;
import org.w3c.dom.Attr;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NamedNodeMap;
import org.w3c.dom.Node;
import org.xml.sax.InputSource;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * 업로드된 SVG 를 허용 목록(allowlist) 방식으로 정제한다. SVG 는 이미지처럼 보이지만 스크립트, 이벤트 핸들러,
 * 외부 리소스 참조, 중첩 문서(foreignObject)를 담을 수 있어 같은 출처에서 서빙하면 저장형 XSS 가 된다.
 *
 * <p>원칙: 알려진 안전한 요소/속성만 새 문서로 복사하고 나머지는 버린다 (위험한 것을 찾아 지우는 방식이 아니다).
 * XML 파싱은 DOCTYPE 자체를 거부해 XXE/엔티티 폭탄을 막는다. 정제할 수 없는 입력은 INVALID_FILE_TYPE 으로 거부한다.
 */
public final class SvgSanitizer {

    public static final int MAX_SVG_BYTES = 512 * 1024;

    private static final String SVG_NS = "http://www.w3.org/2000/svg";
    private static final String XMLNS_NS = "http://www.w3.org/2000/xmlns/";
    private static final String XLINK_NS = "http://www.w3.org/1999/xlink";
    private static final int MAX_NODES = 5_000;
    private static final int MAX_DEPTH = 40;

    private static final Set<String> ALLOWED_ELEMENTS = Set.of(
            "svg", "g", "defs", "title", "desc", "symbol", "use", "style",
            "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
            "text", "tspan",
            "linearGradient", "radialGradient", "stop", "pattern", "clipPath", "mask",
            "filter", "feBlend", "feColorMatrix", "feComposite", "feFlood", "feGaussianBlur", "feMerge",
            "feMergeNode", "feOffset", "feDropShadow"
    );

    /** 텍스트를 담을 수 있는 요소 (그 밖의 요소 안의 텍스트는 공백만 남긴다). */
    private static final Set<String> TEXT_ELEMENTS = Set.of("text", "tspan", "title", "desc", "style");

    private static final Set<String> ALLOWED_ATTRIBUTES = Set.of(
            // 구조/식별
            "id", "class", "version", "viewBox", "preserveAspectRatio", "xml:space",
            // 기하
            "x", "y", "width", "height", "cx", "cy", "r", "rx", "ry", "x1", "y1", "x2", "y2", "fx", "fy",
            "points", "d", "transform", "dx", "dy", "rotate", "textLength", "lengthAdjust", "offset",
            // 그라디언트/패턴/클립/마스크
            "gradientUnits", "gradientTransform", "spreadMethod", "patternUnits", "patternTransform",
            "patternContentUnits", "clipPathUnits", "maskUnits", "maskContentUnits",
            // 필터
            "in", "in2", "result", "stdDeviation", "mode", "type", "values", "operator", "k1", "k2", "k3", "k4",
            "flood-color", "flood-opacity", "filterUnits", "primitiveUnits",
            // 표현
            "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-linecap",
            "stroke-linejoin", "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "opacity", "color",
            "display", "visibility", "font-family", "font-size", "font-weight", "font-style", "text-anchor",
            "dominant-baseline", "letter-spacing", "word-spacing", "text-decoration", "clip-path", "clip-rule",
            "mask", "filter", "stop-color", "stop-opacity", "style"
    );

    private static final Pattern SAFE_ID = Pattern.compile("^[A-Za-z0-9_.:-]{1,100}$");
    /** url(...) 은 같은 문서 안(#id)만 가리킬 수 있다. */
    private static final Pattern EXTERNAL_URL = Pattern.compile("url\\(\\s*['\"]?\\s*(?!#)", Pattern.CASE_INSENSITIVE);

    private SvgSanitizer() {
    }

    /** 정제된 SVG 바이트를 돌려준다. 안전하게 정제할 수 없으면 INVALID_FILE_TYPE. */
    public static byte[] sanitize(byte[] input) {
        if (input == null || input.length == 0 || input.length > MAX_SVG_BYTES) {
            throw invalid();
        }
        Document source = parse(input);
        Element root = source.getDocumentElement();
        if (root == null || !"svg".equals(root.getLocalName()) || !SVG_NS.equals(root.getNamespaceURI())) {
            throw invalid();
        }

        Document clean = newDocument();
        int[] nodeCount = {0};
        Element cleanRoot = copyElement(clean, root, 0, nodeCount);
        cleanRoot.setAttributeNS(XMLNS_NS, "xmlns", SVG_NS);
        clean.appendChild(cleanRoot);
        return serialize(clean);
    }

    private static Element copyElement(Document target, Element source, int depth, int[] nodeCount) {
        if (depth > MAX_DEPTH || ++nodeCount[0] > MAX_NODES) {
            throw invalid();
        }
        Element copy = target.createElementNS(SVG_NS, source.getLocalName());
        copyAttributes(source, copy);

        boolean keepText = TEXT_ELEMENTS.contains(source.getLocalName());
        for (Node child = source.getFirstChild(); child != null; child = child.getNextSibling()) {
            switch (child.getNodeType()) {
                case Node.ELEMENT_NODE -> {
                    Element childElement = (Element) child;
                    // 허용 목록에 없는 요소(script, foreignObject, animate, a, image, iframe ...)는 하위 요소째 버린다
                    if (SVG_NS.equals(childElement.getNamespaceURI()) && ALLOWED_ELEMENTS.contains(childElement.getLocalName())) {
                        Element copied = copyElement(target, childElement, depth + 1, nodeCount);
                        if (copied != null) {
                            copy.appendChild(copied);
                        }
                    }
                }
                case Node.TEXT_NODE, Node.CDATA_SECTION_NODE -> {
                    String text = child.getNodeValue();
                    if (keepText && text != null) {
                        if ("style".equals(source.getLocalName()) && !isSafeCss(text)) {
                            // 안전하다고 확인할 수 없는 CSS 는 통째로 버린다
                            return null;
                        }
                        copy.appendChild(target.createTextNode(text));
                    }
                }
                default -> {
                    // 주석, 처리 명령 등은 버린다
                }
            }
        }
        return copy;
    }

    private static void copyAttributes(Element source, Element copy) {
        NamedNodeMap attributes = source.getAttributes();
        for (int i = 0; i < attributes.getLength(); i++) {
            Attr attr = (Attr) attributes.item(i);
            String name = attr.getName();
            String value = attr.getValue();
            if (XMLNS_NS.equals(attr.getNamespaceURI()) || name.startsWith("xmlns")) {
                continue; // 네임스페이스 선언은 루트에 직접 넣는다
            }

            if ("href".equals(attr.getLocalName()) && (attr.getNamespaceURI() == null || XLINK_NS.equals(attr.getNamespaceURI()))) {
                // 같은 문서 안의 참조(#id)만 허용한다. 외부 주소와 javascript:/data: 는 모두 버린다
                if (value.startsWith("#") && SAFE_ID.matcher(value.substring(1)).matches()) {
                    copy.setAttribute("href", value);
                }
                continue;
            }
            if (attr.getNamespaceURI() != null && !"xml:space".equals(name)) {
                continue;
            }
            if (!ALLOWED_ATTRIBUTES.contains(name)) {
                continue; // on* 이벤트 핸들러 포함, 허용 목록에 없는 속성은 버린다
            }
            if ("id".equals(name) && !SAFE_ID.matcher(value).matches()) {
                continue;
            }
            if (!isSafeValue(name, value)) {
                continue;
            }
            copy.setAttribute(name, value);
        }
    }

    private static boolean isSafeValue(String name, String value) {
        String lower = value.toLowerCase(Locale.ROOT);
        if (lower.contains("javascript:") || lower.contains("vbscript:") || lower.contains("data:") || lower.contains("<")) {
            return false;
        }
        // 정상적인 SVG 속성 값에는 역슬래시가 필요 없다. CSS 이스케이프(u\72l(...) = url(...))로 외부 주소 검사를 피하는 수법을 막는다.
        if (value.indexOf('\\') >= 0) {
            return false;
        }
        if ("style".equals(name)) {
            return isSafeCss(value);
        }
        return !EXTERNAL_URL.matcher(value).find();
    }

    /** 외부 리소스 로딩(@import, url(), image-set 등)과 스크립트 실행 수단(expression, behavior)이 없는 CSS 만 허용한다. */
    static boolean isSafeCss(String css) {
        String lower = css.toLowerCase(Locale.ROOT);
        if (lower.contains("@") || lower.contains("\\") || lower.contains("<") || lower.contains("expression")
                || lower.contains("javascript") || lower.contains("behavior") || lower.contains("-moz-binding")
                || lower.contains("image-set") || lower.contains("data:")) {
            return false;
        }
        return !EXTERNAL_URL.matcher(css).find();
    }

    private static Document parse(byte[] input) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            // DOCTYPE 을 아예 허용하지 않아 외부 엔티티(XXE)와 엔티티 폭탄을 원천 차단한다
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            DocumentBuilder builder = factory.newDocumentBuilder();
            builder.setEntityResolver((publicId, systemId) -> new InputSource(new ByteArrayInputStream(new byte[0])));
            builder.setErrorHandler(null);
            return builder.parse(new ByteArrayInputStream(input));
        } catch (Exception e) {
            throw invalid();
        }
    }

    private static Document newDocument() {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            return factory.newDocumentBuilder().newDocument();
        } catch (Exception e) {
            throw invalid();
        }
    }

    private static byte[] serialize(Document document) {
        try {
            TransformerFactory factory = TransformerFactory.newInstance();
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_STYLESHEET, "");
            Transformer transformer = factory.newTransformer();
            transformer.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "yes");
            transformer.setOutputProperty(OutputKeys.ENCODING, StandardCharsets.UTF_8.name());
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            transformer.transform(new DOMSource(document), new StreamResult(out));
            return out.toByteArray();
        } catch (Exception e) {
            throw invalid();
        }
    }

    private static BlogException invalid() {
        return new BlogException(ErrorCode.INVALID_FILE_TYPE);
    }
}
