package com.doro.blog.common.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HandlesTest {

    @Test
    void stripsOnlyOneLeadingAt() {
        assertThat(Handles.stripAt("@doro")).isEqualTo("doro");
        assertThat(Handles.stripAt("doro")).isEqualTo("doro");
        assertThat(Handles.stripAt("@@doro")).isEqualTo("@doro");
        assertThat(Handles.stripAt("do@ro")).isEqualTo("do@ro");
    }
}
