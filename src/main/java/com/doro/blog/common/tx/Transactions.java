package com.doro.blog.common.tx;

import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.function.Supplier;

/**
 * 코드로 트랜잭션 범위를 정하는 도우미. 서비스 메서드 전체를 @Transactional 로 감싸면 그 안의 원격 호출(Guard)도
 * DB 연결을 쥔 채 기다리게 된다. 원격 호출은 트랜잭션 밖에 두고, DB 작업만 이 도우미로 짧게 감싼다.
 * 이미 열린 트랜잭션 안에서 부르면 그 트랜잭션에 참여한다.
 */
@Component
public class Transactions {

    private final TransactionTemplate writeTemplate;
    private final TransactionTemplate readTemplate;

    public Transactions(PlatformTransactionManager manager) {
        this.writeTemplate = new TransactionTemplate(manager);
        this.readTemplate = new TransactionTemplate(manager);
        this.readTemplate.setReadOnly(true);
    }

    /** 쓰기 트랜잭션에서 action 을 실행한다. 예외가 나면 롤백하고 그 예외를 그대로 던진다. */
    public <T> T write(Supplier<T> action) {
        return writeTemplate.execute(status -> action.get());
    }

    /** 읽기 전용 트랜잭션에서 action 을 실행한다. */
    public <T> T read(Supplier<T> action) {
        return readTemplate.execute(status -> action.get());
    }
}
